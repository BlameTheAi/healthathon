import unittest
from datetime import date
from unittest.mock import patch

from fastapi.testclient import TestClient

from main import app
from services.gemini_service import GeminiRateLimitError
from services.registration_validation import calculate_age


client = TestClient(app)

QUESTIONS = [
    {"id": "full_name", "question": {"en": "Could you tell me your full name?"}, "required": True, "enabled": True},
    {"id": "date_of_birth", "question": {"en": "And what is your date of birth?"}, "required": True, "enabled": True},
    {"id": "gender", "question": {"en": "What is your gender?"}, "required": True, "enabled": True},
    {"id": "phone", "question": {"en": "What is your mobile number?"}, "required": True, "enabled": True},
    {"id": "visit_reason", "question": {"en": "What brings you in today?"}, "required": True, "enabled": True},
]


def model_output(**overrides):
    output = {
        "spoken_reply": "",
        "detected_correction": False,
        "is_registration_complete": False,
        "next_question_id": None,
        "current_extracted_data": {
            "full_name": None,
            "date_of_birth": None,
            "gender": None,
            "phone": None,
            "visit_reason": None,
        },
    }
    output.update(overrides)
    return output


class RegistrationApiTests(unittest.TestCase):
    def post(self, text, current_state=None, questions=None):
        return client.post(
            "/api/registration/conversation",
            json={
                "language": "en-IN",
                "conversation": [{"role": "patient", "text": text}],
                "questions": QUESTIONS if questions is None else questions,
                "current_state": current_state or {},
            },
        )

    def post_conversation(self, conversation, current_state=None):
        return client.post(
            "/api/registration/conversation",
            json={
                "language": "en-IN",
                "conversation": conversation,
                "questions": QUESTIONS,
                "current_state": current_state or {},
            },
        )

    @patch("services.registration_service.generate_structured_response")
    def test_asks_next_missing_field_and_returns_cumulative_state(self, generate):
        generate.return_value = model_output(
            spoken_reply="Thanks, Raj. And what is your date of birth?",
            next_question_id="date_of_birth",
            current_extracted_data={"full_name": "Raj", "date_of_birth": None, "visit_reason": None},
        )

        response = self.post("My name is Raj")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["next_question"]["id"], "date_of_birth")
        self.assertEqual(body["extracted_information"]["full_name"], "Raj")
        self.assertEqual(
            body["missing_required_fields"],
            ["date_of_birth", "gender", "phone", "visit_reason"],
        )
        self.assertFalse(body["is_registration_complete"])
        self.assertFalse(body["detected_correction"])

    @patch("services.registration_service.generate_structured_response")
    def test_self_correction_overwrites_prior_value_and_flags_toast(self, generate):
        generate.return_value = model_output(
            spoken_reply="Got it, Jonathan. I've updated that. And what is your date of birth?",
            detected_correction=True,
            next_question_id="date_of_birth",
            current_extracted_data={"full_name": "Jonathan", "date_of_birth": None, "visit_reason": None},
        )

        body = self.post("My name is John... wait, no, Jonathan", {"full_name": "John"}).json()

        self.assertEqual(generate.call_args.kwargs["current_state"]["full_name"], "John")
        self.assertTrue(body["detected_correction"])
        self.assertEqual(body["corrected_fields"], ["full_name"])
        self.assertEqual(body["extracted_information"]["full_name"], "Jonathan")

    @patch("services.registration_service.generate_structured_response")
    def test_ambiguous_dob_is_not_guessed_and_is_clarified(self, generate):
        generate.return_value = model_output(
            spoken_reply="No problem at all. Could you confirm if the year was 1990 or 1985?",
            next_question_id="date_of_birth",
            current_extracted_data={"full_name": "Raj", "date_of_birth": None, "visit_reason": None},
        )

        body = self.post("1990, or maybe 1985, I forget", {"full_name": "Raj"}).json()

        self.assertIsNone(body["extracted_information"]["date_of_birth"])
        self.assertEqual(body["next_question"]["id"], "date_of_birth")
        self.assertIn("1990 or 1985", body["next_question"]["text"])

    @patch("services.registration_service.generate_structured_response")
    def test_partial_birth_date_asks_only_for_year(self, generate):
        response = self.post_conversation(
            [
                {"role": "assistant", "text": "What is your date of birth?"},
                {"role": "patient", "text": "14th October"},
            ],
            {"full_name": "Raj"},
        )

        body = response.json()
        self.assertEqual(body["next_question"], {"id": "date_of_birth", "text": "What year were you born?"})
        self.assertEqual(body["extracted_information"]["full_name"], "Raj")
        generate.assert_not_called()

    @patch("services.registration_service.generate_structured_response")
    def test_year_answer_completes_previous_partial_birth_date(self, generate):
        generate.return_value = model_output(
            spoken_reply="Thank you. What is your gender?",
            next_question_id="gender",
        )
        response = self.post_conversation(
            [
                {"role": "assistant", "text": "What is your date of birth?"},
                {"role": "patient", "text": "14th October"},
                {"role": "assistant", "text": "What year were you born?"},
                {"role": "patient", "text": "1995"},
            ],
            {"full_name": "Raj"},
        )

        body = response.json()
        self.assertEqual(generate.call_args.kwargs["current_state"]["date_of_birth"], "1995-10-14")
        self.assertEqual(body["extracted_information"]["date_of_birth"], "1995-10-14")
        self.assertEqual(body["next_question"]["id"], "gender")

    @patch("services.registration_service.generate_structured_response")
    def test_one_word_gender_answer_is_retained(self, generate):
        generate.return_value = model_output(next_question_id="phone")
        response = self.post(
            "female",
            {
                "full_name": "Raj",
                "date_of_birth": "1995-10-14",
            },
        )

        body = response.json()
        self.assertEqual(body["extracted_information"]["gender"], "Female")
        self.assertEqual(body["next_question"]["id"], "phone")
        generate.assert_not_called()

    @patch("services.registration_service.generate_structured_response")
    def test_one_word_name_is_saved_without_waiting_for_model_extraction(self, generate):
        for answer in ("max", "max max"):
            with self.subTest(answer=answer):
                response = self.post_conversation(
                    [
                        {"role": "assistant", "text": "Could you tell me your full name?"},
                        {"role": "patient", "text": answer},
                    ]
                )

                body = response.json()
                self.assertEqual(body["extracted_information"]["full_name"], "Max")
                self.assertEqual(body["next_question"]["id"], "date_of_birth")
                self.assertFalse(body["is_registration_complete"])

        generate.assert_not_called()

    @patch("services.registration_service.generate_structured_response")
    def test_name_answer_uses_active_prompt_even_if_an_earlier_field_is_missing(self, generate):
        response = self.post_conversation(
            [
                {"role": "assistant", "text": "What should we call you?"},
                {"role": "patient", "text": "Max"},
            ],
            {"date_of_birth": "1995-10-14"},
        )

        body = response.json()
        self.assertEqual(body["extracted_information"]["full_name"], "Max")
        self.assertEqual(body["next_question"]["id"], "gender")
        generate.assert_not_called()

    @patch("services.registration_service.generate_structured_response")
    def test_one_word_male_and_speech_to_text_homophone_are_retained(self, generate):
        state = {
            "full_name": "Raj",
            "date_of_birth": "1995-10-14",
        }

        for answer in ("MALE", "mail"):
            with self.subTest(answer=answer):
                response = self.post_conversation(
                    [
                        {"role": "assistant", "text": "What is your gender?"},
                        {"role": "patient", "text": answer},
                    ],
                    state,
                )

                body = response.json()
                self.assertEqual(body["extracted_information"]["gender"], "Male")
                self.assertEqual(body["next_question"]["id"], "phone")
                self.assertFalse(body["is_registration_complete"])

        generate.assert_not_called()

    @patch("services.registration_service.generate_structured_response")
    def test_gender_answer_uses_active_prompt_even_if_an_earlier_field_is_missing(self, generate):
        response = self.post_conversation(
            [
                {"role": "assistant", "text": "What is your gender?"},
                {"role": "patient", "text": "male"},
            ],
            {"full_name": "Raj"},
        )

        body = response.json()
        self.assertEqual(body["extracted_information"]["gender"], "Male")
        self.assertEqual(body["next_question"]["id"], "date_of_birth")
        generate.assert_not_called()

    @patch("services.registration_service.generate_structured_response")
    def test_yes_no_short_answers_are_retained_for_binary_questions(self, generate):
        generate.return_value = model_output(
            spoken_reply="Thank you, that's everything I need.",
            is_registration_complete=True,
        )
        questions = QUESTIONS + [
            {
                "id": "previous_visit",
                "question": {"en": "Have you visited our hospital before?"},
                "required": True,
                "enabled": True,
            },
        ]
        prior = {
            "full_name": "Raj",
            "date_of_birth": "1995-10-14",
            "gender": "Female",
            "phone": "9876543210",
            "visit_reason": "Follow up",
        }

        for answer, expected in [("YES!", "Yes"), ("nah", "No")]:
            with self.subTest(answer=answer):
                body = self.post(answer, prior, questions).json()
                self.assertEqual(body["extracted_information"]["previous_visit"], expected)
                self.assertTrue(body["is_registration_complete"])

    @patch("services.registration_service.generate_structured_response")
    def test_yes_no_short_answer_is_not_applied_to_non_binary_question(self, generate):
        generate.return_value = model_output(next_question_id="full_name")

        body = self.post("no", {}).json()

        self.assertIsNone(body["extracted_information"]["full_name"])
        self.assertEqual(body["next_question"]["id"], "full_name")

    @patch("services.registration_service.generate_structured_response")
    def test_null_from_model_never_erases_earlier_answers(self, generate):
        generate.return_value = model_output(
            spoken_reply="Thank you, that's everything I need.",
            is_registration_complete=True,
        )
        prior = {
            "full_name": "Raj",
            "date_of_birth": "1990-01-01",
            "gender": "Male",
            "phone": "9876543210",
            "visit_reason": "Follow up",
        }

        body = self.post("Sorry, nothing new", prior).json()

        self.assertTrue(body["is_registration_complete"])
        self.assertIsNone(body["next_question"])
        self.assertEqual(body["extracted_information"], prior)

    @patch("services.registration_service.generate_structured_response")
    def test_mismatched_next_question_falls_back_to_configured_wording(self, generate):
        generate.return_value = model_output(
            spoken_reply="What brings you in today?",
            next_question_id="visit_reason",
        )

        body = self.post("hmm", {}).json()

        self.assertEqual(body["next_question"]["id"], "full_name")
        self.assertEqual(body["next_question"]["text"], "Could you tell me your full name?")

    @patch("services.registration_service.generate_structured_response")
    def test_unconfigured_model_fields_are_never_stored(self, generate):
        output = model_output(spoken_reply="Thanks. And your date of birth?", next_question_id="date_of_birth")
        output["current_extracted_data"]["diagnosis"] = "not allowed"
        generate.return_value = output

        body = self.post("My name is Raj", {}).json()

        self.assertNotIn("diagnosis", body["extracted_information"])

    @patch("services.registration_service.generate_structured_response")
    def test_model_cannot_complete_before_all_core_fields_are_valid(self, generate):
        generate.return_value = model_output(
            spoken_reply="Thank you, that's everything I need.",
            is_registration_complete=True,
            current_extracted_data={"full_name": "Raj"},
        )

        body = self.post("My name is Raj", {}).json()

        self.assertFalse(body["is_registration_complete"])
        self.assertEqual(body["next_question"]["id"], "date_of_birth")
        self.assertEqual(
            body["missing_required_fields"],
            ["date_of_birth", "gender", "phone", "visit_reason"],
        )

    @patch("services.registration_service.generate_structured_response")
    def test_core_questions_are_restored_when_client_settings_disable_them(self, generate):
        generate.return_value = model_output(next_question_id="full_name")
        stale_config = [
            {
                "id": "full_name",
                "question": {"en": "Name?"},
                "required": False,
                "enabled": False,
            },
            {
                "id": "age",
                "question": {"en": "How old are you?"},
                "required": True,
                "enabled": True,
            },
        ]

        body = self.post("hello", questions=stale_config).json()

        supplied_questions = generate.call_args.kwargs["questions"]
        self.assertEqual(
            [question["id"] for question in supplied_questions[:5]],
            ["full_name", "date_of_birth", "gender", "phone", "visit_reason"],
        )
        self.assertTrue(all(question["required"] and question["enabled"] for question in supplied_questions[:5]))
        self.assertNotIn("age", [question["id"] for question in supplied_questions])
        self.assertEqual(body["next_question"]["id"], "full_name")

    @patch("services.registration_service.generate_structured_response")
    def test_age_is_not_asked_and_not_required_when_date_of_birth_is_known(self, generate):
        generate.return_value = model_output(
            current_extracted_data={
                "full_name": "Raj",
                "date_of_birth": "1990-01-01",
                "gender": "Male",
                "phone": "9876543210",
                "visit_reason": "Follow up",
            },
        )

        body = self.post("Raj, born on January 1st 1990, male, 9876543210, follow up").json()

        sent_questions = generate.call_args.kwargs["questions"]
        self.assertNotIn("age", [question["id"] for question in sent_questions])
        self.assertTrue(body["is_registration_complete"])
        self.assertEqual(body["missing_required_fields"], [])

    @patch("registration_api.create_registration")
    def test_submit_rejects_missing_required_fields_without_saving(self, create):
        response = client.post(
            "/api/registration/submit",
            json={"patient_data": {"full_name": "Raj", "visit_reason": "Follow up"}},
        )

        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["detail"]["code"], "incomplete_registration")
        create.assert_not_called()

    @patch("registration_api.create_registration")
    def test_submit_saves_complete_normalized_required_fields(self, create):
        create.return_value = {
            "id": "registration-id",
            "sequence": 1,
            "status": "PENDING_VERIFICATION",
        }
        patient_data = {
            "full_name": " Raj ",
            "date_of_birth": "1990-01-01",
            "age": "999",
            "gender": "Male",
            "phone": "+91 98765-43210",
            "visit_reason": " Follow up ",
        }

        response = client.post(
            "/api/registration/submit",
            json={"patient_data": patient_data},
        )

        self.assertEqual(response.status_code, 201)
        saved_data = create.call_args.args[0]
        self.assertEqual(saved_data["full_name"], "Raj")
        self.assertEqual(saved_data["phone"], "919876543210")
        self.assertEqual(saved_data["visit_reason"], "Follow up")
        self.assertNotEqual(saved_data["age"], "999")
        self.assertEqual(saved_data["age"], str(calculate_age("1990-01-01")))

    @patch("registration_api.verify_registration")
    def test_staff_date_of_birth_edit_recalculates_age(self, verify):
        verify.return_value = {
            "id": "registration-id",
            "patient_data": {
                "full_name": "Raj",
                "date_of_birth": "2000-10-03",
                "age": "1",
                "gender": "Male",
                "phone": "9876543210",
                "visit_reason": "Follow up",
            },
            "status": "VERIFIED",
            "created_at": "2026-10-03T00:00:00+00:00",
        }
        patient_data = {
            "full_name": "Raj",
            "date_of_birth": "2000-10-03",
            "age": "1",
            "gender": "Male",
            "phone": "9876543210",
            "visit_reason": "Follow up",
        }

        response = client.put(
            "/api/staff/verify/registration-id",
            json={"patient_data": patient_data},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            verify.call_args.args[1]["age"],
            str(calculate_age("2000-10-03")),
        )

    def test_calculates_age_around_birthday(self):
        self.assertEqual(calculate_age("2000-10-04", date(2026, 10, 3)), 25)
        self.assertEqual(calculate_age("2000-10-03", date(2026, 10, 3)), 26)

    @patch("registration_api.delete_pending_registration", return_value=True)
    def test_staff_can_delete_pending_registration(self, delete):
        response = client.delete("/api/staff/queue/registration-id")

        self.assertEqual(response.status_code, 204)
        delete.assert_called_once_with("registration-id")

    @patch("registration_api.delete_pending_registration", return_value=False)
    def test_delete_returns_not_found_for_non_pending_registration(self, delete):
        response = client.delete("/api/staff/queue/missing-id")

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["detail"]["code"], "not_found")
        delete.assert_called_once_with("missing-id")

    @patch("services.registration_service.generate_structured_response")
    def test_maps_rate_limit_to_recoverable_429(self, generate):
        generate.side_effect = GeminiRateLimitError()

        response = self.post("hello")

        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.json()["detail"]["code"], "rate_limit")


if __name__ == "__main__":
    unittest.main()
