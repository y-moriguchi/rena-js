/**
 * rena.js
 *
 * Copyright (c) 2018 Yuichiro MORIGUCHI
 *
 * This software is released under the MIT License.
 * http://opensource.org/licenses/mit-license.php
 **/
/*
 * This test case describe by Jasmine.
 */
describe("Rena", function () {
	function match(pattern, string, match, lastIndex) {
		var result = pattern.parseStart(string);
		expect(result.match).toBe(match);
		expect(result.lastIndex).toBe(lastIndex);
	}

	function nomatch(pattern, string) {
		expect(pattern.parseStart(string)).toBeNull();
	}

	function attr(match, attr, inherit) {
		return function(m, a, i, e) {
			expect(m).toBe(match);
			expect(a).toBe(attr);
			expect(i).toBe(inherit);
		}
	}

	function fntest(str, index) {
		if(str.charAt(index) === "a") {
			return {
				match: "a",
				lastIndex: index + 1
			};
		} else {
			return null;
		}
	}

	beforeEach(function () {
	});

	describe("testing match", function () {
		it("simple string match", function () {
			match(R().then("string"), "string", "string", 6);
			match(R().then("string"), "strings", "string", 6);
			nomatch(R().then("string"), "strin");
			match(R().then(""), "string", "", 0);
			match(R.then("string"), "string", "string", 6);
			match(R().t("string"), "string", "string", 6);
			match(R.t("string"), "string", "string", 6);
			R.then("string", attr("string")).parse("string");
		});
		it("simple regex match", function () {
			match(R().then(/[0-9]+/), "765", "765", 3);
			match(R().then(/[0-9]+/), "765AS", "765", 3);
			nomatch(R().then(/[0-9]+/), "strin");
			R.then(/[0-9]+/, attr("765")).parse("765");
			R.then(/[0-9]([0-9]*)/, function(m, a, i, e) {
				expect(e[0]).toBe("765");
				expect(e[1]).toBe("65");
			}).parse("765");
		});
		it("simple function match", function () {
			match(R().then(fntest), "a", "a", 1);
			nomatch(R().then(fntest), "s");
			R.then(fntest, attr("a")).parse("a");
		});
		it("simple Rena match", function () {
			match(R().then(R.t("string")), "string", "string", 6);
			match(R().then(R.t("string")), "strings", "string", 6);
			nomatch(R().then(R.t("string")), "strin");
			R.then(R.t("string"), attr("string")).parse("string");
		});
		it("unsupport match", function() {
			expect(function() { R.t(null).parse("a"); }).toThrow();
		});
		it("chaining then", function () {
			var ptn = R.then("string").then("match");
			match(ptn, "stringmatch", "stringmatch", 11);
			match(ptn, "stringmatches", "stringmatch", 11);
			nomatch(ptn, "stringmatc");
			nomatch(ptn, "strinmatch");
		});
		it("thenPass", function () {
			var ptn = R.then(/[a-z]+/, R.I).thenPass("Match");
			expect(ptn.parse("stringMatch").attribute).toBe("string");
		});
		it("thenInt", function () {
			expect(R().thenInt(/[0-9]+/).parse("765").attribute).toBe(765);
			expect(R.thenInt(/[0-9]+/).parse("765").attribute).toBe(765);
		});
		it("thenFloat", function () {
			expect(R().thenFloat(/[0-9]+\.[0-9]+/).parse("76.5").attribute).toBe(76.5);
			expect(R.thenFloat(/[0-9]+\.[0-9]+/).parse("76.5").attribute).toBe(76.5);
		});
		it("br", function () {
			match(R().br(), "\n", "\n", 1);
			match(R().br(), "\r", "\r", 1);
			match(R().br(), "\r\n", "\r\n", 2);
			nomatch(R().br(), "a");
			match(R.br(), "\n", "\n", 1);
		});
		it("isEnd", function () {
			match(R().then("765").isEnd(), "765", "765", 3);
			nomatch(R().then("765").isEnd(), "765961");
			match(R.isEnd(), "", "", 0);
		});
		it("equalsId", function () {
			var Q1 = R.clone(),
				Q2 = R.clone(),
				Q3 = R.clone();
			match(R().equalsId("if"), "if", "if", 2);
			match(R().equalsId("if"), "if ", "if", 2);
			match(R().equalsId("if"), "iff", "if", 2);
			Q1.ignoreDefault(/\s+/);
			match(Q1().equalsId("if"), "if", "if", 2);
			match(Q1().equalsId("if"), "if ", "if ", 3);
			nomatch(Q1().equalsId("if"), "iff");
			nomatch(Q1().equalsId("if"), "if+");
			Q2.setKey("+", "++", "-");
			match(Q2().equalsId("if"), "if", "if", 2);
			match(Q2().equalsId("if"), "if+", "if", 2);
			match(Q2().equalsId("if"), "if++", "if", 2);
			match(Q2().equalsId("if"), "if-", "if", 2);
			nomatch(Q2().equalsId("if"), "if ");
			nomatch(Q2().equalsId("if"), "iff");
			Q3.ignoreDefault(/\s+/);
			Q3.setKey("+", "++", "-");
			match(Q3().equalsId("if"), "if", "if", 2);
			match(Q3().equalsId("if"), "if ", "if ", 3);
			match(Q3().equalsId("if"), "if+", "if", 2);
			match(Q3().equalsId("if"), "if++", "if", 2);
			match(Q3().equalsId("if"), "if-", "if", 2);
			nomatch(Q3().equalsId("if"), "iff");
			match(Q2.equalsId("if"), "if+", "if", 2);
		});
		it("or", function () {
			var ptn = R().or("string", /[0-9]+/, fntest, R("match")),
				ptn2 = R().or(["string", /[0-9]+/, fntest, R("match")]);
			match(ptn, "string", "string", 6);
			match(ptn, "765", "765", 3);
			match(ptn, "a", "a", 1);
			match(ptn, "match", "match", 5);
			nomatch(ptn, "-");
			match(R().or("string"), "string", "string", 6);
			nomatch(R().or("string"), "a");
			nomatch(R().or(), "string");
			match(R.or("string"), "string", "string", 6);
			match(ptn2, "string", "string", 6);
			match(ptn2, "765", "765", 3);
			match(ptn2, "a", "a", 1);
			match(ptn2, "match", "match", 5);
		});
		it("matching times", function () {
			match(R().times(2, 4, "str"), "strstr", "strstr", 6);
			match(R().times(2, 4, "str"), "strstrstr", "strstrstr", 9);
			match(R().times(2, 4, "str"), "strstrstrstr", "strstrstrstr", 12);
			match(R().times(2, 4, "str"), "strstrstrstrstr", "strstrstrstr", 12);
			nomatch(R().times(2, 4, "str"), "str");
			match(R().times(2, 2, "str"), "strstr", "strstr", 6);
			match(R().times(2, 2, "str"), "strstrstr", "strstr", 6);
			nomatch(R().times(2, 2, "str"), "str");
			match(R().times(0, 1, "str"), "str", "str", 3);
			match(R().times(0, 1, "str"), "", "", 0);
			match(R().times(0, 1, "str"), "strstr", "str", 3);
			match(R().times(2, -1, "str"), "strstr", "strstr", 6);
			match(R().times(2, -1, "str"), "strstrstrstrstr", "strstrstrstrstr", 15);
			nomatch(R().times(2, -1, "str"), "str");
			expect(function() { R().times(-1, 1, "str").parse("a"); }).toThrow();
			expect(function() { R().times(0, 0, "str").parse("a"); }).toThrow();
			expect(function() { R().times(1, 0, "str").parse("a"); }).toThrow();
			match(R.times(2, 4, "str"), "strstr", "strstr", 6);
		});
		it("attribute of times", function () {
			var ptn1 = R().times(1, -1, R.then(/[a-z]/, R.I), function(x, a, b) { return a + b; }, ""),
				ptn3 = R.times(1, 3, R.then(/[a-z]/, R.I), function(x, a, b) { return a + b; }, "");
			expect(ptn1.parse("string").attribute).toBe("gnirts");
			expect(ptn3.parseStart("string").attribute).toBe("rts");
			expect(ptn3.parse("str").attribute).toBe("rts");
			expect(ptn3.parse("st").attribute).toBe("ts");
			expect(ptn3.parse("s").attribute).toBe("s");
		});
		it("atLeast", function () {
			var ptn1 = R().atLeast(1, R.then(/[a-z]/, R.I), function(x, a, b) { return a + b; }, ""),
				ptn2 = R.atLeast(1, R.then(/[a-z]/, R.I), function(x, a, b) { return a + b; }, "");
			match(R().atLeast(2, "str"), "strstr", "strstr", 6);
			match(R().atLeast(2, "str"), "strstrstrstrstr", "strstrstrstrstr", 15);
			nomatch(R().atLeast(2, "str"), "str");
			expect(function() { R().atLeast(-1, "str").parse("a"); }).toThrow();
			expect(ptn1.parse("string").attribute).toBe("gnirts");
			expect(ptn2.parse("string").attribute).toBe("gnirts");
		});
		it("atMost", function () {
			var ptn1 = R().atMost(3, R.then(/[a-z]/, R.I), function(x, a, b) { return a + b; }, ""),
				ptn2 = R.atMost(3, R.then(/[a-z]/, R.I), function(x, a, b) { return a + b; }, "");
			match(R().atMost(4, "str"), "", "", 0);
			match(R().atMost(4, "str"), "str", "str", 3);
			match(R().atMost(4, "str"), "strstr", "strstr", 6);
			match(R().atMost(4, "str"), "strstrstr", "strstrstr", 9);
			match(R().atMost(4, "str"), "strstrstrstr", "strstrstrstr", 12);
			match(R().atMost(4, "str"), "strstrstrstrstr", "strstrstrstr", 12);
			expect(ptn1.parseStart("string").attribute).toBe("rts");
			expect(ptn1.parse("str").attribute).toBe("rts");
			expect(ptn1.parse("st").attribute).toBe("ts");
			expect(ptn1.parse("s").attribute).toBe("s");
			expect(ptn1.parse("").attribute).toBe("");
			expect(ptn2.parseStart("string").attribute).toBe("rts");
			match(R.atMost(4, "str"), "strstrstrstrstr", "strstrstrstr", 12);
		});
		it("maybe", function () {
			match(R().maybe("string"), "string", "string", 6);
			match(R().maybe("string"), "strings", "string", 6);
			match(R().maybe("string"), "strin", "", 0);
			match(R().maybe("string"), "stringstring", "string", 6);
			match(R.maybe("string"), "string", "string", 6);
			R().maybe("string", attr("string")).parse("string");
			expect(R().maybe("string", R.I).parse("string").attribute).toBe("string");
			expect(R().maybe("string", R.I).parseStart("strin").attribute).toBe(undefined);
			expect(R.maybe("string", R.I).parse("string").attribute).toBe("string");
		});
		it("oneOrMore", function () {
			var ptn1 = R().oneOrMore(R.then(/[a-z]/, R.I), function(x, a, b) { return a + b; }, ""),
				ptn2 = R.oneOrMore(R.then(/[a-z]/, R.I), function(x, a, b) { return a + b; }, "");
			match(R().oneOrMore("str"), "str", "str", 3);
			match(R().oneOrMore("str"), "strstrstrstrstr", "strstrstrstrstr", 15);
			nomatch(R().oneOrMore("str"), "");
			expect(ptn1.parse("string").attribute).toBe("gnirts");
			expect(ptn2.parse("string").attribute).toBe("gnirts");
			match(R.oneOrMore("str"), "str", "str", 3);
		});
		it("zeroOrMore", function () {
			var ptn1 = R().zeroOrMore(R.then(/[a-z]/, R.I), function(x, a, b) { return a + b; }, ""),
				ptn2 = R().zeroOrMore(R.then(/[a-z]/, R.I), function(x, a, b) { return a + b; }, "");
			match(R().zeroOrMore("str"), "", "", 0);
			match(R().zeroOrMore("str"), "str", "str", 3);
			match(R().zeroOrMore("str"), "strstrstrstrstr", "strstrstrstrstr", 15);
			expect(ptn1.parse("string").attribute).toBe("gnirts");
			expect(ptn2.parse("string").attribute).toBe("gnirts");
			match(R.zeroOrMore("str"), "str", "str", 3);
		});
		it("delimit", function () {
			var ptn1 = R().delimit(R.then(/[0-9]+/, R.I), "+", function(x, a, b) { return a + b; }, ""),
				ptn2 = R.delimit(R.then(/[0-9]+/, R.I), "+", function(x, a, b) { return a + b; }, "");
			match(R().delimit(/[0-9]+/, "+"), "7", "7", 1);
			match(R().delimit(/[0-9]+/, "+"), "7+65", "7+65", 4);
			match(R().delimit(/[0-9]+/, "+"), "7+", "7", 1);
			nomatch(R().delimit(/[0-9]+/, "+"), "");
			nomatch(R().delimit(/[0-9]+/, "+"), "a+7");
			nomatch(R().delimit(/[0-9]+/, "+"), "+961");
			expect(ptn1.parse("765+346+876").attribute).toBe("876346765");
			expect(ptn2.parse("765+346+876").attribute).toBe("876346765");
			match(R.delimit(/[0-9]+/, "+"), "7+65", "7+65", 4);
		});
		it("timesArray", function () {
			var ptn1 = R().timesArray(1, -1, R.then(/[a-z]/, R.I)),
				ptn2 = R.timesArray(1, -1, R.then(/[a-z]/, R.I));
			expect(ptn1.parse("str").attribute).toEqual(["s", "t", "r"]);
			expect(ptn1.parse("s").attribute).toEqual(["s"]);
			expect(ptn2.parse("str").attribute).toEqual(["s", "t", "r"]);
		});
		it("atLeastArray", function () {
			var ptn1 = R().atLeastArray(1, R.then(/[a-z]/, R.I)),
				ptn2 = R.atLeastArray(1, R.then(/[a-z]/, R.I));
			expect(ptn1.parse("str").attribute).toEqual(["s", "t", "r"]);
			expect(ptn1.parse("s").attribute).toEqual(["s"]);
			expect(ptn2.parse("str").attribute).toEqual(["s", "t", "r"]);
		});
		it("atMostArray", function () {
			var ptn1 = R().atMostArray(3, R.then(/[a-z]/, R.I)),
				ptn2 = R.atMostArray(3, R.then(/[a-z]/, R.I));
			expect(ptn1.parseStart("stri").attribute).toEqual(["s", "t", "r"]);
			expect(ptn1.parse("str").attribute).toEqual(["s", "t", "r"]);
			expect(ptn1.parse("s").attribute).toEqual(["s"]);
			expect(ptn1.parse("").attribute).toEqual([]);
			expect(ptn2.parse("str").attribute).toEqual(["s", "t", "r"]);
		});
		it("oneOrMoreArray", function () {
			var ptn1 = R().oneOrMoreArray(R.then(/[a-z]/, R.I)),
				ptn2 = R.oneOrMoreArray(R.then(/[a-z]/, R.I));
			expect(ptn1.parse("str").attribute).toEqual(["s", "t", "r"]);
			expect(ptn1.parse("s").attribute).toEqual(["s"]);
			expect(ptn2.parse("str").attribute).toEqual(["s", "t", "r"]);
		});
		it("zeroOrMoreArray", function () {
			var ptn1 = R().zeroOrMoreArray(R.then(/[a-z]/, R.I)),
				ptn2 = R.zeroOrMoreArray(R.then(/[a-z]/, R.I));
			expect(ptn1.parse("str").attribute).toEqual(["s", "t", "r"]);
			expect(ptn1.parse("s").attribute).toEqual(["s"]);
			expect(ptn1.parse("").attribute).toEqual([]);
			expect(ptn2.parse("str").attribute).toEqual(["s", "t", "r"]);
		});
		it("delimitArray", function () {
			var ptn1 = R().delimitArray(R.then(/[0-9]+/, R.I), "+"),
				ptn2 = R.delimitArray(R.then(/[0-9]+/, R.I), "+");
			expect(ptn1.parse("765+346+876").attribute).toEqual(["765", "346", "876"]);
			expect(ptn1.parse("765").attribute).toEqual(["765"]);
			expect(ptn2.parse("765+346+876").attribute).toEqual(["765", "346", "876"]);
		});
		it("lookahead", function () {
			match(R().lookahead(/[0-9]+pro/, true).then(/[0-9]+/), "765pro", "765", 3);
			match(R().lookahead(/[0-9]+pro/, false).then(/[0-9]+/), "765studio", "765", 3);
			match(R().then(/[0-9]+/).lookahead("pro", true), "765pro", "765", 3);
			match(R().then(/[0-9]+/).lookahead("pro", false), "765studio", "765", 3);
			match(R().then(/[0-9]+/).lookahead("pro", false), "765", "765", 3);
			nomatch(R().lookahead(/[0-9]+pro/, true).then(/[0-9]+/), "765studio");
			nomatch(R().lookahead(/[0-9]+pro/, false).then(/[0-9]+/), "765pro");
			nomatch(R().then(/[0-9]+/).lookahead("pro", true), "765studio");
			nomatch(R().then(/[0-9]+/).lookahead("pro", true), "765");
			nomatch(R().then(/[0-9]+/).lookahead("pro", false), "765pro");
			match(R().lookahead(/[0-9]+pro/).then(/[0-9]+/), "765pro", "765", 3);
			match(R().then(/[0-9]+/).lookahead("pro"), "765pro", "765", 3);
			nomatch(R().then(/[0-9]+/).lookahead("pro"), "765studio");
			match(R.lookahead(/[0-9]+pro/, true).then(/[0-9]+/), "765pro", "765", 3);
		});
		it("lookaheadNot", function () {
			match(R().lookaheadNot(/[0-9]+pro/).then(/[0-9]+/), "765studio", "765", 3);
			match(R().then(/[0-9]+/).lookaheadNot("pro"), "765studio", "765", 3);
			match(R().then(/[0-9]+/).lookaheadNot("pro"), "765", "765", 3);
			nomatch(R().lookaheadNot(/[0-9]+pro/).then(/[0-9]+/), "765pro");
			nomatch(R().then(/[0-9]+/).lookaheadNot("pro"), "765pro");
			match(R.lookaheadNot(/[0-9]+pro/).then(/[0-9]+/), "765studio", "765", 3);
		});
		it("cond", function () {
			match(R().cond(function() { return true; }).then(/[0-9]+/), "765", "765", 3);
			nomatch(R().cond(function() { return false; }).then(/[0-9]+/), "765");
			match(R().thenInt(/[0-9]+/).cond(function(x) { return x === 765; }), "765", "765", 3);
			nomatch(R().thenInt(/[0-9]+/).cond(function(x) { return x === 765; }), "961");
			match(R.cond(function() { return true; }).then(/[0-9]+/), "765", "765", 3);
		});
		it("passAll", function () {
			var ptn1 = R().passAll().atMost(3, R.then(/[a-z]/, R.I), function(x, a, b) { return a + b; }, ""),
				ptn2 = R.passAll().atMost(3, R.then(/[a-z]/, R.I), function(x, a, b) { return a + b; }, "");
			expect(ptn1.parse("str").attribute).toBe(undefined);
			expect(ptn2.parse("str").attribute).toBe(undefined);
			expect(R().passAll().thenInt(/[0-9]+/).parse("765").attribute).toBe(undefined);
			expect(R().passAll().attr("z").parse("").attribute).toBe(undefined);
			expect(R().passAll().action(function() { return "x"; }).parse("").attribute).toBe(undefined);
		});
		it("attr", function () {
			var ptn1 = R().attr("z").zeroOrMore(R.then(/[a-z]/, R.I), function(x, a, b) { return a + b; }),
				ptn2 = R.attr("z").zeroOrMore(R.then(/[a-z]/, R.I), function(x, a, b) { return a + b; });
			expect(R().attr("z").then(/[0-9]+/, function(x, a, b) { return b + x; }).parse("765").attribute).toBe("z765");
			expect(ptn1.parse("str").attribute).toBe("rtsz");
			expect(ptn1.parse("").attribute).toBe("z");
			expect(ptn2.parse("str").attribute).toBe("rtsz");
		});
		it("action", function () {
			expect(R().attr("z").action(function(x) {
				return "x" + x;
			}).then(/[0-9]+/, function(x, a, b) { return b + x; }).parse("765").attribute).toBe("xz765");
			expect(R.action(function() { return "x"; }).parse("").attribute).toBe("x");
		});
		it("key", function () {
			var Q = R.clone(),
				trie = R.createKey("*", "+", "++");
			match(R().key("+", trie), "+", "+", 1);
			match(R().key("++", trie), "++", "++", 2);
			match(R().key("*", trie), "*", "*", 1);
			nomatch(R().key("+", trie), "++");
			nomatch(R().key("++", trie), "+");
			Q.setKey("*", "+", "++");
			match(Q().key("+"), "+", "+", 1);
			match(Q().key("++"), "++", "++", 2);
			match(Q().key("*"), "*", "*", 1);
			match(R.key("+", trie), "+", "+", 1);
		});
		it("notKey", function () {
			var Q = R.clone(),
				trie = R.createKey("*", "+", "++");
			match(R().notKey(trie), "/", "", 0);
			nomatch(R().notKey(trie), "+");
			nomatch(R().notKey(trie), "++");
			nomatch(R().notKey(trie), "*");
			Q.setKey("*", "+", "++");
			match(Q().notKey(), "/", "", 0);
			nomatch(Q().notKey(), "+");
			nomatch(Q().notKey(), "++");
			nomatch(Q().notKey(), "*");
			match(R.notKey(trie), "/", "", 0);
		});
		it("parseStart", function () {
			expect(R.then("765").parseStart("961765", 3).match).toBe("765");
			expect(R.cond(function(x) { return x === 765; }).parseStart("", 0, 765).match).toBe("");
		});
		it("parse", function () {
			expect(R.then("765").parse("765").match).toBe("765");
			expect(R.then("765").parse("765961")).toBeFalsy();
			expect(R.cond(function(x) { return x === 765; }).parse("", 765).match).toBe("");
		});
		it("parsePart", function () {
			expect(R.then("765").parsePart("765").match).toBe("765");
			expect(R.then("765").parsePart("765").startIndex).toBe(0);
			expect(R.then("765").parsePart("765346").match).toBe("765");
			expect(R.then("765").parsePart("765346").startIndex).toBe(0);
			expect(R.then("765").parsePart("876765346").match).toBe("765");
			expect(R.then("765").parsePart("876765346").startIndex).toBe(3);
			expect(R.then("765").parsePart("961")).toBeFalsy();
			expect(R.cond(function(x) { return x === 765; }).parsePart("", 765).match).toBe("");
		});
		it("parsePartGlobal", function () {
			expect(R.then(/[0-9]+/, R.I).parsePartGlobal("765x876xx346xxx", "", function (a, b) { return b + a; })).toBe("765876346");
			expect(R.then(/[0-9]+/, R.I).parsePartGlobal("xxx765x876xx346", "", function (a, b) { return b + a; })).toBe("765876346");
			expect(R.then(/[0-9]+/, R.I).parsePartGlobal("xxx", "", function (a, b) { return b + a; })).toBe("");
			expect(R.then(/[0-9]+/, R.I).parsePartGlobal("", "", function (a, b) { return b + a; })).toBe("");
		});
		it("parsePartGlobalArray", function () {
			expect(R.then(/[0-9]+/, R.I).parsePartGlobalArray("765x876xx346xxx")).toEqual(["765", "876", "346"]);
			expect(R.then(/[0-9]+/, R.I).parsePartGlobalArray("xxx765x876xx346")).toEqual(["765", "876", "346"]);
			expect(R.then(/[0-9]+/, R.I).parsePartGlobalArray("xxx")).toEqual([]);
			expect(R.then(/[0-9]+/, R.I).parsePartGlobalArray("")).toEqual([]);
		});
		it("I", function () {
			expect(R.I(1)).toBe(1);
			expect(R.first(1)).toBe(1);
		});
		it("F", function () {
			expect(R.F(1, 2)).toBe(2);
			expect(R.SK(1, 2)).toBe(2);
			expect(R.second(1, 2)).toBe(2);
		});
		it("Y", function () {
			var ptn1 = R.Y(function(s) {
				return R.or(R.t("(").t(s).t(")"), R());
			}).isEnd();
			match(ptn1, "((()))", "((()))", 6);
			match(ptn1, "", "", 0);
			nomatch(ptn1, "((())");
			nomatch(ptn1, "(()))");
		});
		it("letrec", function () {
			var ptn1 = R.letrec(function(t, f, e) {
					return R.t(f).zeroOrMore(R.or(
						R.t("+").t(f, function(x, a, b) { return b + a; }),
						R.t("-").t(f, function(x, a, b) { return b - a; })));
				},
				function(t, f, e) {
					return R.t(e).zeroOrMore(R.or(
						R.t("*").t(e, function(x, a, b) { return b * a; }),
						R.t("/").t(e, function(x, a, b) { return b / a; })));
				},
				function(t, f, e) {
					return R.or(R.thenInt(/[0-9]+/), R.t("(").t(t).t(")"))
				}).isEnd();
			expect(ptn1.parse("1+2*3").attribute).toBe(7);
			expect(ptn1.parse("(1+2)*3").attribute).toBe(9);
			expect(ptn1.parse("4-6/2").attribute).toBe(1);
			expect(ptn1.parse("1+2+3*3").attribute).toBe(12);
		});
		it("Yn", function () {
			var ptn1 = R.Yn(function(t, f, e) {
					return R.t(f).zeroOrMore(R.or(
						R.t("+").t(f, function(x, a, b) { return b + a; }),
						R.t("-").t(f, function(x, a, b) { return b - a; })));
				},
				function(t, f, e) {
					return R.t(e).zeroOrMore(R.or(
						R.t("*").t(e, function(x, a, b) { return b * a; }),
						R.t("/").t(e, function(x, a, b) { return b / a; })));
				},
				function(t, f, e) {
					return R.or(R.thenInt(/[0-9]+/), R.t("(").t(t).t(")"))
				}).isEnd();
			expect(ptn1.parse("1+2*3").attribute).toBe(7);
			expect(ptn1.parse("(1+2)*3").attribute).toBe(9);
			expect(ptn1.parse("4-6/2").attribute).toBe(1);
			expect(ptn1.parse("1+2+3*3").attribute).toBe(12);
		});
		it("ignoreDefault", function () {
			var Q = R.clone().ignoreDefault(/\s+/),
				ptn1 = Q.letrec(function(t, f, e) {
					return Q.t(f).zeroOrMore(Q.or(
						Q.t("+").t(f, function(x, a, b) { return b + a; }),
						Q.t("-").t(f, function(x, a, b) { return b - a; })));
				},
				function(t, f, e) {
					return Q.t(e).zeroOrMore(Q.or(
						Q.t("*").t(e, function(x, a, b) { return b * a; }),
						Q.t("/").t(e, function(x, a, b) { return b / a; })));
				},
				function(t, f, e) {
					return Q.or(Q.thenInt(/[0-9]+/), Q.t("(").t(t).t(")"))
				}).isEnd();
			expect(ptn1.parse(" 1  +  2  *  3  ").attribute).toBe(7);
			expect(ptn1.parse("   (   1 + 2 ) * 3 ").attribute).toBe(9);
			expect(ptn1.parse("  4  -  6/   2   ").attribute).toBe(1);
			expect(ptn1.parse(" 1  +  2  + 3  *  3  ").attribute).toBe(12);
		});
		it("ignore", function () {
			var Q = R.clone().ignoreDefault(/\s+/),
				ptn1 = Q.ignore(null).t(/[a-z]+/),
				ptn2 = Q.t(/[a-z]+/);
			match(ptn1, "xyz   ", "xyz", 3);
			match(ptn2, "xyz   ", "xyz   ", 6);
		});
		it("inhibited chain", function () {
			var i;
			for(i in R) {
				if(R.prototype.hasOwnProperty(i)) {
					if(i !== "br" && i !== "isEnd" && i !== "equalsId") {
						expect(function() { (R().times(0, 1, "str"))[i]().parse("a"); }).toThrow();
						expect(function() { (R().maybe("str"))[i]().parse("a"); }).toThrow();
						expect(function() { (R().atLeast(1, "str"))[i]().parse("a"); }).toThrow();
						expect(function() { (R().atMost(1, "str"))[i]().parse("a"); }).toThrow();
						expect(function() { (R().zeroOrMore("str"))[i]().parse("a"); }).toThrow();
						expect(function() { (R().oneOrMore("str"))[i]().parse("a"); }).toThrow();
						expect(function() { (R().delimit("str", "x"))[i]().parse("a"); }).toThrow();
					}
				}
			}
		});
		it("CSV", function () {
			var csvparser = new R();
			csvparser.t(R.attr([]).maybe(R.delimitArray(R.delimitArray(R.or(
				R('"').t(/(""|[^"])+/, function(x) { return x.replace('""', '"'); }).t('"'),
				R(/[^",\n\r]+/, R.I)), ","), R.br()))).maybe(R.br()).isEnd();
			expect(csvparser.parse('a,b,c\nd,"e\n""f",g\nh\n').attribute).toEqual([["a","b","c"],["d","e\n\"f","g"],["h"]]);
			expect(csvparser.parse('a,b,c\nd,"e\n""f",g\nh').attribute).toEqual([["a","b","c"],["d","e\n\"f","g"],["h"]]);
			expect(csvparser.parse('d,"e\n""f",g').attribute).toEqual([["d","e\n\"f","g"]]);
			expect(csvparser.parse('d').attribute).toEqual([["d"]]);
			expect(csvparser.parse('').attribute).toEqual([]);
		});
		it("operatorGrammar", function () {
			var Q = R.clone(),
				arr,
				ptn1,
				ptn2;
			arr = [{
					name: "S",
					associative: "pre",
					operators: {
						"not": function(a) { return a ? 0 : 1; }
					}
				},{
					associative: "post",
					operators: {
						"?": function(a) { return a ? 1 : 0; }
					}
				},{
					associative: "left",
					operators: {
						"+": function(b, a) { return b + a; },
						"-": function(b, a) { return b - a; }
					}
				},{
					associative: "left",
					operators: {
						"*": function(b, a) { return b * a; },
						"/": function(b, a) { return b / a; }
					}
				},{
					associative: "right",
					operators: {
						"**": function(b, a) { return Math.pow(b, a); }
					}
				},{
					associative: "pre",
					operators: {
						"-": function(a) { return -a; },
						"@": function(a) { return a + 1; }
					}
				},{
					associative: "post",
					operators: {
						"!": function(a) {
							var i = a - 1,
								res = a;
							for(; i > 1; i--) {
								res *= i;
							}
							return res;
						},
						"@": function(a) { return a - 1; }
					}
				},{
					grammar: function(g) {
						return Q.or(Q.thenInt(/[0-9]+/), Q.key("(").t(g.S).key(")"));
					}
				}];
			Q.setKey("+", "-", "*", "/", "**", "(", ")", "@", "not", "!", "?");
			ptn1 = Q.operatorGrammar(arr);
			ptn2 = Q.operatorGrammar.apply(null, arr);
			expect(ptn1.parse("1").attribute).toBe(1);
			expect(ptn1.parse("1+2").attribute).toBe(3);
			expect(ptn1.parse("1+2+3+4+5+6+7+8+9+10").attribute).toBe(55);
			expect(ptn1.parse("1+2*3").attribute).toBe(7);
			expect(ptn1.parse("(1+2)*3").attribute).toBe(9);
			expect(ptn1.parse("4-6/2").attribute).toBe(1);
			expect(ptn1.parse("1+2+3*3").attribute).toBe(12);
			expect(ptn1.parse("2*2**3").attribute).toBe(16);
			expect(ptn1.parse("2*2**3**2").attribute).toBe(1024);
			expect(ptn1.parse("2*(2**3)**2").attribute).toBe(128);
			expect(ptn1.parse("(1+2)*3").attribute).toBe(9);
			expect(ptn1.parse("-1").attribute).toBe(-1);
			expect(ptn1.parse("--1").attribute).toBe(1);
			expect(ptn1.parse("-@1").attribute).toBe(-2);
			expect(ptn1.parse("2+-@1+@3").attribute).toBe(4);
			expect(ptn1.parse("not1+2*3").attribute).toBe(0);
			expect(ptn1.parse("not-6+2*3").attribute).toBe(1);
			expect(ptn1.parse("-(not-6+2*3)").attribute).toBe(-1);
			expect(ptn1.parse("not@-1").attribute).toBe(1);
			expect(ptn1.parse("(not1)+2*3").attribute).toBe(6);
			expect(ptn1.parse("4!").attribute).toBe(24);
			expect(ptn1.parse("4@!").attribute).toBe(6);
			expect(ptn1.parse("4@@@@").attribute).toBe(0);
			expect(ptn1.parse("not4@@@@").attribute).toBe(1);
			expect(ptn1.parse("4+3!").attribute).toBe(10);
			expect(ptn1.parse("(4+3)!").attribute).toBe(5040);
			expect(ptn1.parse("1+2*3?").attribute).toBe(1);
			expect(ptn1.parse("4+3!?").attribute).toBe(1);
			expect(ptn1.parse("(4+3?)!").attribute).toBe(1);
			expect(ptn1.parse("1+2*(3?)").attribute).toBe(3);
			expect(ptn2.parse("(1+2)*3").attribute).toBe(9);
		});
	});
});
