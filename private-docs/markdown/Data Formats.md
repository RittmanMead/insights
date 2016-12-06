% Data Formats

The `BIColumn` class contains a `format` function which uses internal properties `DataFormat` and `DataType` to parse raw values into formatted strings. Below are the specifications for how this parsing is done for different data types.

# String

**Data Type:** `varchar`

String formats use `%s` as a placeholder for the text, and then allow prefixing and suffixing. E.g. for a given value, '2015', a data format of `Year: %s` will produce 'Year: 2015'.

# Number

**Data Type:** `integer`, `double`

Number formats using the [D3 format](https://github.com/mbostock/d3/wiki/Formatting#numbers) specification. The general form is as follows:

```
[​[fill]align][sign][symbol][0][width][,][.precision][type]
```

## Types

The available type values are:

* Exponent (`e`) - Outputs the number as an exponent.
* General (`g`) - General number display.
* Fixed (`f`) - Outputs the number with a fixed number of decimal places.
* Integer (`d`) - Integer only, ignores decimals.
* Rounded (`r`) - Round to precision significant digits, padding with zeroes where necessary in similar fashion to fixed (`f`). If no precision is specified, falls back to general notation.
* Percentage (`%`) - Like fixed, but multiply by 100 and suffix with `%`.
* Rounded Percentage (`p`) - Like rounded, but multiply by 100 and suffix with `%`.
* Binary (`b`) - Outputs the number in base 2.
* Octal (`o`) - Outputs the number in base 8.
* Hexadecimal (`x`) - Outputs the number in base 16, using lower-case letters for the digits above 9.
* Hexadecimal (`X`) - Outputs the number in base 16, using upper-case letters for the digits above 9.
* Character (`c`) - Converts the integer to the corresponding unicode character before printing.
* SI-prefix (`s`) - Like rounded, but with a unit suffixed such as "9.5M" for mega, or "1.00µ" for micro.

The type `n` is also supported as shorthand for `,g`.

## Precision

Can use this with most types to specify the number of significant figures or decimal places a number should display.

```javascript
d3.format(".3g")(1000.987654); // "1.00e+3"
d3.format(".3r")(1000.987654); // "1000"
d3.format(".3f")(1000.987654); // "100.988"
d3.format(".3s")(1000.987654); // "1.00k"
```

## Fill/Align

Fill will ensure that the number string will have a definite amount of characters, with any missing characters filled in by the fill character. Align is used to decide the placement.

* `>` To the right
* `<` To the left
* `^` Either side

```javascript
d3.format("4>8")(1); //"44444441"
d3.format("4^8")(1); //"44441444"
d3.format("4<8")(1); //"14444444"
```

## Sign

Sign (+/-) will prefix the number with a sign indicating its polarity.
Using a space instead will pad positive numbers with a leading space, and use '-' for negatives.

```javascript
d3.format("+")(125);  //"+125"
d3.format("+")(-125); //"-125"
d3.format("-")(125);  //"125"
d3.format("-")(-125); //"-125"
d3.format(" ")(125);  //" 125"
d3.format(" ")(-125); //"-125"
```

## Symbol

Symbols can take one of two forms:

* Currency ("$") - a currency symbol should be prefixed (or suffixed) per the locale. The default local is specified in `pluginAPI.js`
* Base ("#") - for binary, octal, or hexadecimal output, prefix by "0b", "0o", or "0x", respectively.

Note that using `£` or any other currency will not work straight away, so a locale must be defined and chosen.

```javascript
d3.format("$,")(1250);         //"$1,250"
d3.format("$,.2f")(1250);      //"$1,250.00
d3.format("0b")(125);  //"1111101"
d3.format("0o")(125);  //"175"
d3.format("0x")(125);  //"7d"
```

## Zero Padding

Specifying a number of zeros will pad the result accordingly. E.g.

```javascript
d3.format("8")(1234);          //"    1234"
d3.format("08")(1234);         //"00001234"
d3.format("08.2f")(123.456);   //"00123.46"
d3.format("08.3f")(123.456);   //"0123.456"
```

## Width

If you want you can specify a minimum width that the output string of the formatter needs to have. This might be usefull if you want to list thousands numbers on top of eachother in a clear overview.

```javascript
d3.format("8")(1);      //"       1"
d3.format("8,.2f")(1);  //"    1.00"
d3.format("8g")(1e6);   //" 1000000"
```

## Comma Separated

Specifying a `,` comma will comma separate the numbers at every 000.

# Date

**Data Type:** `date`

Uses the [D3 time](https://github.com/mbostock/d3/wiki/Time-Formatting) specification. The BI server outputs all dates as YYYY-MM-DD, which is useful as plugin developers can parse the raw data generically. The custom format function will take the raw value as a string in YYYY-MM-DD format and apply the D3 format mask to it.

* `%a` - abbreviated weekday name.
* `%A` - full weekday name.
* `%b` - abbreviated month name.
* `%B` - full month name.
* `%c` - date and time, as `%a %b %e %H:%M:%S %Y`.
* `%d` - zero-padded day of the month as a decimal number [01,31].
* `%e` - space-padded day of the month as a decimal number [ 1,31]; equivalent to `%_d`.
* `%H` - hour (24-hour clock) as a decimal number [00,23].
* `%I`` - hour (12-hour clock) as a decimal number [01,12].
* `%j - day of the year as a decimal number [001,366].
* `%m` - month as a decimal number [01,12].
* `%M` - minute as a decimal number [00,59].
* `%L` - milliseconds as a decimal number [000, 999].
* `%p` - either AM or PM.
* `%S` - second as a decimal number [00,61].
* `%U` - week number of the year (Sunday as the first day of the week) as a decimal number [00,53].
* `%w` - weekday as a decimal number [0(Sunday),6].
* `%W` - week number of the year (Monday as the first day of the week) as a decimal number [00,53].
* `%x` - date, as `%m/%d/%Y`.
* `%X` - time, as `%H:%M:%S`.
* `%y` - year without century as a decimal number [00,99].
* `%Y` - year with century as a decimal number.
* `%Z` - time zone offset, such as "-0700".
* `%%` - a literal "%" character.

E.g.
```javascript
// D3 Manipulation
var test = '2015-10-12'; // Mon Oct 12 2015
var testDate = d3.time.format('%Y-%m-%d').parse(test);
d3.time.format('%Y-%m-%d')(testDate) // 2015-10-12
d3.time.format('%d %B %Y')(testDate) // 12 October 2015

// OBIEE Web API Manipulation
var column = new obiee.BIColumn(name, code, ...) // Declare OBIEE column
column.DataType = 'date';
column.DataFormat = '%d %B %Y';
column.format(test) // 12 October 2015
```
