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
		var result = pattern.parse(string);
		expect(result.match).toBe(match);
		expect(result.lastIndex).toBe(lastIndex);
	}

	function nomatch(pattern, string) {
		expect(pattern.parse(string)).toBeNull();
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
		it("or", function () {
			var ptn = R().or("string", /[0-9]+/, fntest, R("match"));
			match(ptn, "string", "string", 6);
			match(ptn, "765", "765", 3);
			match(ptn, "a", "a", 1);
			match(ptn, "match", "match", 5);
			nomatch(ptn, "-");
			match(R().or("string"), "string", "string", 6);
			nomatch(R().or("string"), "a");
			nomatch(R().or(), "string");
			match(R.or("string"), "string", "string", 6);
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
			expect(function() { R().times(-1, 1).parse("a"); }).toThrow();
			expect(function() { R().times(0, 0).parse("a"); }).toThrow();
			expect(function() { R().times(1, 0).parse("a"); }).toThrow();
			match(R.times(2, 4, "str"), "strstr", "strstr", 6);
		});
		it("attribute of times", function () {
			var ptn1 = R().times(1, -1, R.then(/[a-z]/, R.I), function(x, a, b) { return a + b; }, ""),
				ptn2 = R().times(1, -1, R.then(/[a-z]/, R.I), function(x, a, b) { return a + b; }, "").then(/[a-z]/),
				ptn3 = R().times(1, 3, R.then(/[a-z]/, R.I), function(x, a, b) { return a + b; }, "");
			expect(ptn1.parse("string").attribute).toBe("gnirts");
			expect(ptn2.parse("string").attribute).toBe("nirts");
			expect(ptn3.parse("string").attribute).toBe("rts");
			expect(ptn3.parse("str").attribute).toBe("rts");
			expect(ptn3.parse("st").attribute).toBe("ts");
			expect(ptn3.parse("s").attribute).toBe("s");
		});
		it("atLeast", function () {
			var ptn1 = R().atLeast(1, R.then(/[a-z]/, R.I), function(x, a, b) { return a + b; }, "");
			match(R().atLeast(2, "str"), "strstr", "strstr", 6);
			match(R().atLeast(2, "str"), "strstrstrstrstr", "strstrstrstrstr", 15);
			nomatch(R().atLeast(2, "str"), "str");
			expect(function() { R().atLeast(-1).parse("a"); }).toThrow();
			expect(ptn1.parse("string").attribute).toBe("gnirts");
		});
		it("atMost", function () {
			var ptn3 = R().atMost(3, R.then(/[a-z]/, R.I), function(x, a, b) { return a + b; }, "");
			match(R().atMost(4, "str"), "", "", 0);
			match(R().atMost(4, "str"), "str", "str", 3);
			match(R().atMost(4, "str"), "strstr", "strstr", 6);
			match(R().atMost(4, "str"), "strstrstr", "strstrstr", 9);
			match(R().atMost(4, "str"), "strstrstrstr", "strstrstrstr", 12);
			match(R().atMost(4, "str"), "strstrstrstrstr", "strstrstrstr", 12);
			expect(ptn3.parse("string").attribute).toBe("rts");
			expect(ptn3.parse("str").attribute).toBe("rts");
			expect(ptn3.parse("st").attribute).toBe("ts");
			expect(ptn3.parse("s").attribute).toBe("s");
			expect(ptn3.parse("").attribute).toBe("");
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
			expect(R().maybe("string", R.I).parse("strin").attribute).toBe(undefined);
		});
		it("oneOrMore", function () {
			var ptn1 = R().oneOrMore(R.then(/[a-z]/, R.I), function(x, a, b) { return a + b; }, "");
			match(R().oneOrMore("str"), "str", "str", 3);
			match(R().oneOrMore("str"), "strstrstrstrstr", "strstrstrstrstr", 15);
			nomatch(R().oneOrMore("str"), "");
			expect(ptn1.parse("string").attribute).toBe("gnirts");
			match(R.oneOrMore("str"), "str", "str", 3);
		});
		it("zeroOrMore", function () {
			var ptn1 = R().zeroOrMore(R.then(/[a-z]/, R.I), function(x, a, b) { return a + b; }, "");
			match(R().zeroOrMore("str"), "", "", 0);
			match(R().zeroOrMore("str"), "str", "str", 3);
			match(R().zeroOrMore("str"), "strstrstrstrstr", "strstrstrstrstr", 15);
			expect(ptn1.parse("string").attribute).toBe("gnirts");
			match(R.zeroOrMore("str"), "str", "str", 3);
		});
		it("delimit", function () {
			var ptn1 = R().delimit(R.then(/[0-9]+/, R.I), "+", function(x, a, b) { return a + b; }, "");
			match(R().delimit(/[0-9]+/, "+"), "7", "7", 1);
			match(R().delimit(/[0-9]+/, "+"), "7+65", "7+65", 4);
			match(R().delimit(/[0-9]+/, "+"), "7+", "7", 1);
			nomatch(R().delimit(/[0-9]+/, "+"), "");
			nomatch(R().delimit(/[0-9]+/, "+"), "a+7");
			nomatch(R().delimit(/[0-9]+/, "+"), "+961");
			expect(ptn1.parse("765+346+876").attribute).toBe("876346765");
			match(R.delimit(/[0-9]+/, "+"), "7+65", "7+65", 4);
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
		it("parse", function () {
			expect(R.then("765").parse("961765", 3).match).toBe("765");
			expect(R.cond(function(x) { return x === 765; }).parse("", 0, 765).match).toBe("");
		});
		it("I", function () {
			expect(R.I(1)).toBe(1);
		});
		it("F", function () {
			expect(R.F(1, 2)).toBe(2);
			expect(R.SK(1, 2)).toBe(2);
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
					return R.t(f).maybe(R.or(
						R.t("+").t(f, function(x, a, b) { return b + a; }),
						R.t("-").t(f, function(x, a, b) { return b - a; })));
				},
				function(t, f, e) {
					return R.t(e).maybe(R.or(
						R.t("*").t(e, function(x, a, b) { return b * a; }),
						R.t("/").t(e, function(x, a, b) { return b / a; })));
				},
				function(t, f, e) {
					return R.or(R.thenInt(/[0-9]+/), R.t("(").t(t).t(")"))
				}).isEnd();
			expect(ptn1.parse("1+2*3").attribute).toBe(7);
			expect(ptn1.parse("4-6/2").attribute).toBe(1);
			expect(R.letrec).toBe(R.Yn);
		});
		it("ignore", function () {
			var Q = R.clone(),
				ptn1 = Q.letrec(function(t, f, e) {
					return Q.t(f).maybe(Q.or(
						Q.t("+").t(f, function(x, a, b) { return b + a; }),
						Q.t("-").t(f, function(x, a, b) { return b - a; })));
				},
				function(t, f, e) {
					return Q.t(e).maybe(Q.or(
						Q.t("*").t(e, function(x, a, b) { return b * a; }),
						Q.t("/").t(e, function(x, a, b) { return b / a; })));
				},
				function(t, f, e) {
					return Q.or(Q.thenInt(/[0-9]+/), Q.t("(").t(t).t(")"))
				}).isEnd();
			Q.ignore(/\s+/);
			expect(ptn1.parse(" 1  +  2  *  3  ").attribute).toBe(7);
			expect(ptn1.parse("  4  -  6/   2   ").attribute).toBe(1);
		});
	});
});