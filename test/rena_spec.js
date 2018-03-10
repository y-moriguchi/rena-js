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
	});
});
