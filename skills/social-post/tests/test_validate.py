import unittest
import json
import subprocess
import sys
from pathlib import Path

SCRIPT = Path(__file__).resolve().parent.parent / "scripts" / "validate.py"

class TestSocialPostValidator(unittest.TestCase):
    def run_validator(self, payload):
        p = subprocess.run([sys.executable, str(SCRIPT)], input=json.dumps(payload).encode(), 
                          stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        out = p.stdout.decode()
        try:
            return p.returncode, json.loads(out) if out else {}
        except Exception:
            return p.returncode, {"raw": out}

    def test_linkedin_valid(self):
        rc, res = self.run_validator({
            "platform": "linkedin",
            "topic": "AI automation for enterprise pipelines"
        })
        self.assertEqual(rc, 0)
        self.assertEqual(res["platform"], "linkedin")
        self.assertIsNotNone(res["postText"])
        self.assertIn("#", res["postText"])  # hashtags at end
        self.assertIsInstance(res["characterCount"], int)
        self.assertIsInstance(res["wordCount"], int)
        self.assertGreaterEqual(res["characterCount"], 1)

    def test_instagram_valid(self):
        rc, res = self.run_validator({
            "platform": "instagram",
            "topic": "Practical AI workflows"
        })
        self.assertEqual(rc, 0)
        self.assertEqual(res["platform"], "instagram")
        self.assertIsNotNone(res["hashtags"])

    def test_twitter_valid(self):
        rc, res = self.run_validator({
            "platform": "twitter/x",
            "topic": "One idea about AI"
        })
        self.assertEqual(rc, 0)
        self.assertEqual(res["platform"], "twitter/x")
        # LI/IG only hashtags specified -> hashtags should be None for others
        self.assertIsNone(res["hashtags"])

    def test_youtube_valid(self):
        rc, res = self.run_validator({
            "platform": "youtube",
            "topic": "Community discussion"
        })
        self.assertEqual(rc, 0)
        self.assertIsNone(res["hashtags"])

    def test_reddit_requires_context(self):
        rc, res = self.run_validator({
            "platform": "reddit",
            "topic": "AI tools"
        })
        self.assertEqual(rc, 1)
        self.assertIn("validationError", res)
        self.assertIn("subredditContext", res["validationError"])

    def test_reddit_valid(self):
        rc, res = self.run_validator({
            "platform": "reddit",
            "topic": "AI adoption",
            "subredditContext": "r/EnterpriseAI - general discussion"
        })
        self.assertEqual(rc, 0)
        self.assertEqual(res["platform"], "reddit")
        self.assertIsNotNone(res["title"])
        self.assertIsInstance(res["body"], str)

    def test_unsupported_platform(self):
        rc, res = self.run_validator({
            "platform": "facebook",
            "topic": "test"
        })
        self.assertEqual(rc, 1)
        self.assertIn("validationError", res)
        self.assertIn("supported values", res["validationError"])

    def test_topic_required(self):
        rc, res = self.run_validator({
            "platform": "linkedin"
        })
        self.assertEqual(rc, 1)
        self.assertIn("validationError", res)

    def test_style_examples_valid(self):
        rc, res = self.run_validator({
            "platform": "linkedin",
            "topic": "test",
            "styleExamples": ["first", "second"]
        })
        self.assertEqual(rc, 0)

    def test_style_examples_invalid_empty(self):
        rc, res = self.run_validator({
            "platform": "linkedin",
            "topic": "test",
            "styleExamples": []
        })
        self.assertEqual(rc, 1)

    def test_style_examples_invalid_type(self):
        rc, res = self.run_validator({
            "platform": "linkedin",
            "topic": "test",
            "styleExamples": ["ok", ""]
        })
        self.assertEqual(rc, 1)

    def test_em_dash_not_present(self):
        rc, res = self.run_validator({
            "platform": "linkedin",
            "topic": "test"
        })
        self.assertEqual(rc, 0)
        self.assertNotIn("—", res["postText"])
        if res["title"]:
            self.assertNotIn("—", res["title"])

if __name__ == "__main__":
    unittest.main()
