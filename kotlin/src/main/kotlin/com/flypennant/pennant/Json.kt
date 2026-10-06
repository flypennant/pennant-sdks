package com.flypennant.pennant

internal object Json {
    fun stringify(value: Any?): String {
        val out = StringBuilder()
        writeValue(out, value)
        return out.toString()
    }

    @Suppress("UNCHECKED_CAST")
    fun parseObject(raw: String): Map<String, Any?> {
        val parser = Parser(raw)
        val value = parser.parseValue()
        parser.expectEnd()
        return value as? Map<String, Any?>
            ?: throw PennantException("Response must be a JSON object.")
    }

    private fun writeValue(out: StringBuilder, value: Any?) {
        when (value) {
            null -> out.append("null")
            is String -> writeString(out, value)
            is Boolean, is Number -> out.append(value)
            is Map<*, *> -> {
                out.append('{')
                var first = true
                for ((key, item) in value) {
                    if (!first) out.append(',')
                    first = false
                    writeString(out, key.toString())
                    out.append(':')
                    writeValue(out, item)
                }
                out.append('}')
            }
            is Iterable<*> -> {
                out.append('[')
                var first = true
                for (item in value) {
                    if (!first) out.append(',')
                    first = false
                    writeValue(out, item)
                }
                out.append(']')
            }
            else -> throw PennantException("Unsupported JSON value: ${value::class.java.name}")
        }
    }

    private fun writeString(out: StringBuilder, text: String) {
        out.append('"')
        for (ch in text) {
            when (ch) {
                '"' -> out.append("\\\"")
                '\\' -> out.append("\\\\")
                '\b' -> out.append("\\b")
                '\u000C' -> out.append("\\f")
                '\n' -> out.append("\\n")
                '\r' -> out.append("\\r")
                '\t' -> out.append("\\t")
                else ->
                    if (ch.code < 0x20) {
                        out.append("\\u%04x".format(ch.code))
                    } else {
                        out.append(ch)
                    }
            }
        }
        out.append('"')
    }

    private class Parser(private val raw: String) {
        private var index = 0

        fun parseValue(): Any? {
            skipWhitespace()
            if (index >= raw.length) throw PennantException("Unexpected end of JSON.")
            return when (raw[index]) {
                '{' -> parseObject()
                '[' -> parseArray()
                '"' -> parseString()
                't' -> parseLiteral("true", true)
                'f' -> parseLiteral("false", false)
                'n' -> parseLiteral("null", null)
                else -> parseNumber()
            }
        }

        private fun parseObject(): Map<String, Any?> {
            expect('{')
            val map = linkedMapOf<String, Any?>()
            skipWhitespace()
            if (peek('}')) {
                index++
                return map
            }
            while (true) {
                skipWhitespace()
                val key = parseString()
                skipWhitespace()
                expect(':')
                map[key] = parseValue()
                skipWhitespace()
                if (peek('}')) {
                    index++
                    return map
                }
                expect(',')
            }
        }

        private fun parseArray(): List<Any?> {
            expect('[')
            val list = mutableListOf<Any?>()
            skipWhitespace()
            if (peek(']')) {
                index++
                return list
            }
            while (true) {
                list.add(parseValue())
                skipWhitespace()
                if (peek(']')) {
                    index++
                    return list
                }
                expect(',')
            }
        }

        private fun parseString(): String {
            expect('"')
            val out = StringBuilder()
            while (index < raw.length) {
                val ch = raw[index++]
                when (ch) {
                    '"' -> return out.toString()
                    '\\' -> {
                        if (index >= raw.length) throw PennantException("Invalid JSON string escape.")
                        out.append(
                            when (val escape = raw[index++]) {
                                '"', '\\', '/' -> escape
                                'b' -> '\b'
                                'f' -> '\u000C'
                                'n' -> '\n'
                                'r' -> '\r'
                                't' -> '\t'
                                'u' -> parseUnicode()
                                else -> throw PennantException("Invalid JSON string escape.")
                            },
                        )
                    }
                    else -> out.append(ch)
                }
            }
            throw PennantException("Unterminated JSON string.")
        }

        private fun parseUnicode(): Char {
            if (index + 4 > raw.length) throw PennantException("Invalid JSON unicode escape.")
            val code =
                raw.substring(index, index + 4).toIntOrNull(16)
                    ?: throw PennantException("Invalid JSON unicode escape.")
            index += 4
            return code.toChar()
        }

        private fun parseLiteral(literal: String, value: Any?): Any? {
            if (!raw.startsWith(literal, index)) throw PennantException("Invalid JSON literal.")
            index += literal.length
            return value
        }

        private fun parseNumber(): Number {
            val start = index
            if (peek('-')) index++
            while (index < raw.length && raw[index].isDigit()) index++
            var decimal = false
            if (peek('.')) {
                decimal = true
                index++
                while (index < raw.length && raw[index].isDigit()) index++
            }
            if (peek('e') || peek('E')) {
                decimal = true
                index++
                if (peek('+') || peek('-')) index++
                while (index < raw.length && raw[index].isDigit()) index++
            }
            val number = raw.substring(start, index)
            return try {
                if (decimal) number.toDouble() else number.toLong().let {
                    if (it in Int.MIN_VALUE..Int.MAX_VALUE) it.toInt() else it
                }
            } catch (ex: NumberFormatException) {
                throw PennantException("Invalid JSON number.", ex)
            }
        }

        fun expectEnd() {
            skipWhitespace()
            if (index < raw.length) throw PennantException("Unexpected data after JSON.")
        }

        private fun skipWhitespace() {
            while (index < raw.length && raw[index].isWhitespace()) index++
        }

        private fun peek(expected: Char): Boolean = index < raw.length && raw[index] == expected

        private fun expect(expected: Char) {
            if (!peek(expected)) throw PennantException("Expected '$expected' in JSON.")
            index++
        }
    }
}
