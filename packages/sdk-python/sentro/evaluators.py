"""Built-in evaluators for dataset runs."""
import json
import re as _re


def exact_match(actual, expected) -> float:
    """Return 1.0 if actual == expected (JSON-serialized), else 0.0."""
    return 1.0 if json.dumps(actual, sort_keys=True) == json.dumps(expected, sort_keys=True) else 0.0


def contains(actual, expected) -> float:
    """Return 1.0 if str(actual) contains str(expected), case-insensitive."""
    return 1.0 if str(expected).lower() in str(actual).lower() else 0.0


def regex_match(pattern: str):
    """Return an evaluator that checks if actual matches the regex pattern."""
    compiled = _re.compile(pattern)

    def _eval(actual, _expected):
        return 1.0 if compiled.search(str(actual)) else 0.0

    return _eval
