#!/usr/bin/env python3
import sys
import json

SUPPORTED = ["linkedin", "instagram", "reddit", "youtube", "twitter/x"]

def error(msg):
    return {"error": msg}

def validate_input(obj):
    if not isinstance(obj, dict):
        return error("input must be a JSON object")
    platform = obj.get("platform")
    if not platform:
        return error("platform is required; must be one of: linkedin, instagram, reddit, youtube, twitter/x")
    if platform not in SUPPORTED:
        return error(f"unsupported platform: {platform}; supported values are: linkedin, instagram, reddit, youtube, twitter/x")
    topic = obj.get("topic")
    if not isinstance(topic, str) or topic.strip() == "":
        return error("topic is required and must be a nonempty string")
    se = obj.get("styleExamples")
    if se is not None:
        if not isinstance(se, list):
            return error("styleExamples must be an array if provided")
        if len(se) == 0 or len(se) > 3:
            return error("styleExamples must contain 1-3 nonempty strings")
        for i, s in enumerate(se):
            if not isinstance(s, str) or s.strip() == "":
                return error(f"styleExamples[{i}] must be a nonempty string")
    if platform == "reddit":
        sc = obj.get("subredditContext")
        if not isinstance(sc, str) or sc.strip() == "":
            return error("subredditContext is required for reddit")
    # unknown fields: don't be strict here, just note? spec says document behavior; validator basic
    return {"ok": True, "input": obj}

def count_words(s):
    if not s:
        return 0
    # simple whitespace split
    return len(s.split())

def build_post(input_obj):
    # minimal skeleton; full logic lives in skill execution; validator just validates shape/constraints
    platform = input_obj["platform"]
    topic = input_obj["topic"]
    review_flags = []
    placement_notes = []
    title = None
    hashtags = []
    post_text_parts = []
    body = ""
    # apply basic punctuation guard conceptually (validator checks)
    # links handling notes
    # platform specifics
    if platform == "reddit":
        title = f"Hook: {topic}"
        body = f"Discussion about {topic}. What are your thoughts?"
        post_text_parts = [body]
        review_flags.append("Missing community rules for subreddit context (ask for rules)")
    elif platform == "linkedin":
        body = (f"At Bishop AI, I focus on practical AI for enterprise. {topic} matters because workflow automation, "
                "pipeline growth, and human-machine collaboration drive measurable outcomes. "
                "What is your biggest challenge in applying AI to your business?")
        post_text_parts = [body]
        hashtags = ["#AI", "#EnterpriseAI", "#B2B", "#Automation", "#Workflow"]
    elif platform == "instagram":
        body = (f"Building AI that works for enterprise. {topic} is about real impact, not hype. "
                "What would help you move faster with AI?")
        post_text_parts = [body]
        hashtags = ["#AI", "#Enterprise", "#Automation"]
    elif platform == "youtube":
        body = ("Community question: what practical steps have you taken to apply AI in your workflow? "
                "Share what worked or what blocked you.")
        post_text_parts = [body]
    elif platform == "twitter/x":
        body = f"Practical AI matters: {topic}. What's your biggest barrier to adoption?"
        post_text_parts = [body]
    # serialize postText
    if platform == "linkedin":
        hashtags_str = " " + " ".join(hashtags) if hashtags else ""
        post_text = body + hashtags_str
    elif platform == "instagram":
        hashtags_str = " " + " ".join(hashtags) if hashtags else ""
        post_text = body + hashtags_str
    else:
        post_text = body
    # counts
    char_count = len(post_text)  # codepoints
    word_count = count_words(post_text)
    # ensure engagement question present (we added)
    res = {
        "platform": platform,
        "postText": post_text,
        "title": title,
        "body": body,
        "characterCount": char_count,
        "wordCount": word_count,
        "hashtags": hashtags if hashtags else (None if platform in ("linkedin","instagram") else None),
        "placementNotes": placement_notes,
        "reviewFlags": review_flags
    }
    # normalize hashtags field: LI/IG may have list; others None per spec intent
    if platform not in ("linkedin","instagram"):
        res["hashtags"] = None
    return res

def main():
    try:
        data = sys.stdin.read()
        obj = json.loads(data)
        v = validate_input(obj)
        if not v.get("ok"):
            print(json.dumps({"validationError": v["error"]}))
            sys.exit(1)
        res = build_post(v["input"])
        # basic checks
        if res["platform"] == "reddit" and not res["title"]:
            print(json.dumps({"validationError": "reddit requires title"}))
            sys.exit(1)
        print(json.dumps(res))
        sys.exit(0)
    except json.JSONDecodeError:
        print(json.dumps({"validationError": "invalid JSON"}))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"validationError": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
