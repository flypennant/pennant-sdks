package com.flypennant.pennant;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Minimal JSON encode/decode for the evaluate request and response shapes. */
final class Json {
  private Json() {}

  static String stringify(Object value) {
    StringBuilder out = new StringBuilder();
    writeValue(out, value);
    return out.toString();
  }

  @SuppressWarnings("unchecked")
  static Map<String, Object> parseObject(String raw) {
    Parser parser = new Parser(raw);
    Object value = parser.parseValue();
    parser.expectEnd();
    if (!(value instanceof Map<?, ?> map)) {
      throw new PennantException("Response must be a JSON object.");
    }
    return (Map<String, Object>) map;
  }

  private static void writeValue(StringBuilder out, Object value) {
    if (value == null) {
      out.append("null");
    } else if (value instanceof String text) {
      writeString(out, text);
    } else if (value instanceof Boolean || value instanceof Number) {
      out.append(value);
    } else if (value instanceof Map<?, ?> map) {
      out.append('{');
      boolean first = true;
      for (Map.Entry<?, ?> entry : map.entrySet()) {
        if (!first) {
          out.append(',');
        }
        first = false;
        writeString(out, String.valueOf(entry.getKey()));
        out.append(':');
        writeValue(out, entry.getValue());
      }
      out.append('}');
    } else if (value instanceof Iterable<?> iterable) {
      out.append('[');
      boolean first = true;
      for (Object item : iterable) {
        if (!first) {
          out.append(',');
        }
        first = false;
        writeValue(out, item);
      }
      out.append(']');
    } else {
      throw new PennantException("Unsupported JSON value: " + value.getClass().getName());
    }
  }

  private static void writeString(StringBuilder out, String text) {
    out.append('"');
    for (int i = 0; i < text.length(); i++) {
      char ch = text.charAt(i);
      switch (ch) {
        case '"' -> out.append("\\\"");
        case '\\' -> out.append("\\\\");
        case '\b' -> out.append("\\b");
        case '\f' -> out.append("\\f");
        case '\n' -> out.append("\\n");
        case '\r' -> out.append("\\r");
        case '\t' -> out.append("\\t");
        default -> {
          if (ch < 0x20) {
            out.append(String.format("\\u%04x", (int) ch));
          } else {
            out.append(ch);
          }
        }
      }
    }
    out.append('"');
  }

  private static final class Parser {
    private final String raw;
    private int index;

    Parser(String raw) {
      this.raw = raw == null ? "" : raw;
    }

    Object parseValue() {
      skipWhitespace();
      if (index >= raw.length()) {
        throw new PennantException("Unexpected end of JSON.");
      }
      char ch = raw.charAt(index);
      return switch (ch) {
        case '{' -> parseObject();
        case '[' -> parseArray();
        case '"' -> parseString();
        case 't' -> parseLiteral("true", Boolean.TRUE);
        case 'f' -> parseLiteral("false", Boolean.FALSE);
        case 'n' -> parseLiteral("null", null);
        default -> parseNumber();
      };
    }

    private Map<String, Object> parseObject() {
      expect('{');
      Map<String, Object> map = new LinkedHashMap<>();
      skipWhitespace();
      if (peek('}')) {
        index++;
        return map;
      }
      while (true) {
        skipWhitespace();
        String key = parseString();
        skipWhitespace();
        expect(':');
        map.put(key, parseValue());
        skipWhitespace();
        if (peek('}')) {
          index++;
          return map;
        }
        expect(',');
      }
    }

    private List<Object> parseArray() {
      expect('[');
      List<Object> list = new ArrayList<>();
      skipWhitespace();
      if (peek(']')) {
        index++;
        return list;
      }
      while (true) {
        list.add(parseValue());
        skipWhitespace();
        if (peek(']')) {
          index++;
          return list;
        }
        expect(',');
      }
    }

    private String parseString() {
      expect('"');
      StringBuilder out = new StringBuilder();
      while (index < raw.length()) {
        char ch = raw.charAt(index++);
        if (ch == '"') {
          return out.toString();
        }
        if (ch == '\\') {
          if (index >= raw.length()) {
            throw new PennantException("Invalid JSON string escape.");
          }
          char escape = raw.charAt(index++);
          out.append(
              switch (escape) {
                case '"', '\\', '/' -> escape;
                case 'b' -> '\b';
                case 'f' -> '\f';
                case 'n' -> '\n';
                case 'r' -> '\r';
                case 't' -> '\t';
                case 'u' -> parseUnicode();
                default -> throw new PennantException("Invalid JSON string escape.");
              });
        } else {
          out.append(ch);
        }
      }
      throw new PennantException("Unterminated JSON string.");
    }

    private char parseUnicode() {
      if (index + 4 > raw.length()) {
        throw new PennantException("Invalid JSON unicode escape.");
      }
      try {
        int code = Integer.parseInt(raw.substring(index, index + 4), 16);
        index += 4;
        return (char) code;
      } catch (NumberFormatException ex) {
        throw new PennantException("Invalid JSON unicode escape.", ex);
      }
    }

    private Object parseLiteral(String literal, Object value) {
      if (!raw.startsWith(literal, index)) {
        throw new PennantException("Invalid JSON literal.");
      }
      index += literal.length();
      return value;
    }

    private Number parseNumber() {
      int start = index;
      if (peek('-')) {
        index++;
      }
      while (index < raw.length() && Character.isDigit(raw.charAt(index))) {
        index++;
      }
      boolean decimal = false;
      if (peek('.')) {
        decimal = true;
        index++;
        while (index < raw.length() && Character.isDigit(raw.charAt(index))) {
          index++;
        }
      }
      if (peek('e') || peek('E')) {
        decimal = true;
        index++;
        if (peek('+') || peek('-')) {
          index++;
        }
        while (index < raw.length() && Character.isDigit(raw.charAt(index))) {
          index++;
        }
      }
      String number = raw.substring(start, index);
      try {
        if (decimal) {
          return Double.parseDouble(number);
        }
        long value = Long.parseLong(number);
        if (value >= Integer.MIN_VALUE && value <= Integer.MAX_VALUE) {
          return (int) value;
        }
        return value;
      } catch (NumberFormatException ex) {
        throw new PennantException("Invalid JSON number.", ex);
      }
    }

    void expectEnd() {
      skipWhitespace();
      if (index < raw.length()) {
        throw new PennantException("Unexpected data after JSON.");
      }
    }

    private void skipWhitespace() {
      while (index < raw.length() && Character.isWhitespace(raw.charAt(index))) {
        index++;
      }
    }

    private boolean peek(char expected) {
      return index < raw.length() && raw.charAt(index) == expected;
    }

    private void expect(char expected) {
      if (!peek(expected)) {
        throw new PennantException("Expected '" + expected + "' in JSON.");
      }
      index++;
    }
  }
}
