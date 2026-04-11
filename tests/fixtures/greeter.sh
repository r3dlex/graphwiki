#!/bin/bash

# Simple greeter functions

greet() {
    echo "Hello, $1!"
}

farewell() {
    echo "Goodbye, $1!"
}

class Greeter {
    constructor(name) {
        this.name = name;
    }

    greet() {
        return `Hello, ${this.name}!`;
    }
}

# Main
greet "world"
