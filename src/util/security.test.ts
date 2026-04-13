import { describe, it, expect } from "vitest";
import { validateUrl, sanitizePath, sanitizeLabel, escapeCypher } from "./security.js";

describe("validateUrl", () => {
  it("accepts a valid https URL", () => {
    const result = validateUrl("https://example.com/page");
    expect(result).toEqual({ valid: true });
  });

  it("accepts a valid http URL", () => {
    const result = validateUrl("http://example.com/page");
    expect(result).toEqual({ valid: true });
  });

  it("blocks file:// scheme", () => {
    const result = validateUrl("file:///etc/passwd");
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/scheme not allowed/i);
  });

  it("blocks javascript: scheme", () => {
    const result = validateUrl("javascript:alert(1)");
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/scheme not allowed/i);
  });

  it("rejects an invalid URL format", () => {
    const result = validateUrl("not a url at all");
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/invalid url format/i);
  });

  it("blocks localhost", () => {
    const result = validateUrl("http://localhost/admin");
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/loopback/i);
  });

  it("blocks IPv6 loopback ::1", () => {
    const result = validateUrl("http://[::1]/admin");
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/loopback/i);
  });

  it("blocks cloud metadata endpoint 169.254.169.254", () => {
    const result = validateUrl("http://169.254.169.254/latest/meta-data/");
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/metadata endpoint/i);
  });

  it("blocks metadata.google.internal", () => {
    const result = validateUrl("http://metadata.google.internal/computeMetadata/v1/");
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/metadata endpoint/i);
  });

  it("blocks 127.x.x.x loopback address", () => {
    const result = validateUrl("http://127.0.0.1/admin");
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/loopback/i);
  });

  it("blocks 127.1.2.3 loopback variant", () => {
    const result = validateUrl("http://127.1.2.3/");
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/loopback/i);
  });

  it("blocks 10.x.x.x private address", () => {
    const result = validateUrl("http://10.0.0.1/");
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/private/i);
  });

  it("blocks 10.255.255.255 private address", () => {
    const result = validateUrl("http://10.255.255.255/");
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/private/i);
  });

  it("blocks 192.168.x.x private address", () => {
    const result = validateUrl("http://192.168.1.100/");
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/private/i);
  });

  it("blocks 172.16.x.x private address", () => {
    const result = validateUrl("http://172.16.0.1/");
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/private/i);
  });

  it("blocks 172.31.x.x private address", () => {
    const result = validateUrl("http://172.31.255.255/");
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/private/i);
  });

  it("allows 172.15.x.x (just outside private range)", () => {
    const result = validateUrl("http://172.15.0.1/");
    expect(result.valid).toBe(true);
  });

  it("allows 172.32.x.x (just outside private range)", () => {
    const result = validateUrl("http://172.32.0.1/");
    expect(result.valid).toBe(true);
  });

  it("blocks 169.254.x.x link-local range", () => {
    const result = validateUrl("http://169.254.0.1/");
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/link-local/i);
  });
});

describe("sanitizePath", () => {
  it("returns the resolved absolute path for a valid relative path inside root", () => {
    const root = "/project";
    const result = sanitizePath("src/index.ts", root);
    expect(result).toBe("/project/src/index.ts");
  });

  it("returns the resolved path when given an absolute path inside root", () => {
    const root = "/project";
    const result = sanitizePath("/project/src/index.ts", root);
    expect(result).toBe("/project/src/index.ts");
  });

  it("accepts a path that resolves exactly to project root", () => {
    const root = "/project";
    const result = sanitizePath(".", root);
    expect(result).toBe("/project");
  });

  it("throws when path contains ../", () => {
    expect(() => sanitizePath("../outside/file.ts", "/project")).toThrow(
      /path traversal detected/i
    );
  });

  it("throws when absolute path escapes project root", () => {
    expect(() => sanitizePath("/etc/passwd", "/project")).toThrow(
      /path escapes project root/i
    );
  });

  it("throws when path resolves outside project root without explicit ../", () => {
    // A deeply nested path that resolves outside via absolute reference
    expect(() => sanitizePath("/tmp/evil", "/project")).toThrow(
      /path escapes project root/i
    );
  });
});

describe("sanitizeLabel", () => {
  it("strips control characters in the range 0x00-0x1F", () => {
    const result = sanitizeLabel("hello\x00world\x1F");
    expect(result).toBe("helloworld");
  });

  it("strips the DEL control character 0x7F", () => {
    const result = sanitizeLabel("hello\x7Fworld");
    expect(result).toBe("helloworld");
  });

  it("truncates labels longer than 256 characters", () => {
    const long = "a".repeat(300);
    const result = sanitizeLabel(long);
    expect(result).toHaveLength(256);
  });

  it("does not truncate labels of exactly 256 characters", () => {
    const exact = "b".repeat(256);
    const result = sanitizeLabel(exact);
    expect(result).toHaveLength(256);
  });

  it("HTML-escapes ampersand &", () => {
    expect(sanitizeLabel("a & b")).toBe("a &amp; b");
  });

  it("HTML-escapes less-than <", () => {
    expect(sanitizeLabel("<script>")).toBe("&lt;script&gt;");
  });

  it("HTML-escapes greater-than >", () => {
    expect(sanitizeLabel("a > b")).toBe("a &gt; b");
  });

  it("HTML-escapes double quote \"", () => {
    expect(sanitizeLabel('say "hello"')).toBe("say &quot;hello&quot;");
  });

  it("HTML-escapes single quote '", () => {
    expect(sanitizeLabel("it's")).toBe("it&#39;s");
  });

  it("returns an empty string unchanged", () => {
    expect(sanitizeLabel("")).toBe("");
  });

  it("leaves plain alphanumeric text unchanged", () => {
    expect(sanitizeLabel("HelloWorld123")).toBe("HelloWorld123");
  });
});

describe("escapeCypher", () => {
  it("escapes a backslash to double backslash", () => {
    expect(escapeCypher("a\\b")).toBe("a\\\\b");
  });

  it("escapes a single quote", () => {
    expect(escapeCypher("it's")).toBe("it\\'s");
  });

  it("escapes a double quote", () => {
    expect(escapeCypher('say "hi"')).toBe('say \\"hi\\"');
  });

  it("escapes all three special characters together", () => {
    expect(escapeCypher("\\\"'")).toBe("\\\\\\\"\\'");
  });

  it("returns an empty string unchanged", () => {
    expect(escapeCypher("")).toBe("");
  });

  it("leaves plain text without special characters unchanged", () => {
    expect(escapeCypher("hello world")).toBe("hello world");
  });
});
