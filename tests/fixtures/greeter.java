public class Greeter {
    private final String greeting;

    public Greeter(String greeting) {
        this.greeting = greeting;
    }

    public String greet(String name) {
        return greeting + ", " + name + "!";
    }

    public static String freeFunction(String name) {
        return "Hello, " + name;
    }

    public static void main(String[] args) {
        Greeter g = new Greeter("Hello");
        System.out.println(g.greet("world"));
    }
}
