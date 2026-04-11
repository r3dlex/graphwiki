"""Simple greeter module."""


def greet(name: str) -> str:
    """Return a greeting."""
    return f"Hello, {name}"


def farewell(name: str) -> str:
    """Return a farewell."""
    return f"Goodbye, {name}"


class Greeter:
    """A greeter class."""

    def __init__(self, greeting: str = "Hello"):
        self.greeting = greeting

    def greet(self, name: str) -> str:
        """Greet someone by name."""
        return f"{self.greeting}, {name}!"
