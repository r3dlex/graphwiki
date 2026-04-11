package main

import "fmt"

type Greeter struct {
	greeting string
}

func NewGreeter(greeting string) *Greeter {
	return &Greeter{greeting: greeting}
}

func (g *Greeter) Greet(name string) string {
	return fmt.Sprintf("%s, %s!", g.greeting, name)
}

func freeFunction(name string) string {
	return fmt.Sprintf("Hello, %s", name)
}

func main() {
	g := NewGreeter("Hello")
	fmt.Println(g.Greet("world"))
}
