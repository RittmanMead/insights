% Advanced Report Building

This document outlines complex report customisations and how they can be achieved using the web API framework.

# Embedding content in OBIEE

While the app has been designed to operate independently of the vanilla OBIEE front end, it is often desirable to embed Insights reports into a dashboard. To do this, the `CookiePath` parameter in `instanceconfig.xml` should be set to `/` as per the [installation guide](installation.html). This allows the app to use the active session ID from within OBIEE. Now dashboards created with the API can be embedded in dashboards as embedded content. The URL should be of the form below where `path` is the web catalogue path to which the dashboard has been saved.

```
/insights/app/states/view/view.html?db=<path>
```

By default OBIEE accepts fixed height and width for embedded content. Adding the script below to a dashboard page will allow it to automatically scale to fit the page.

```html
<script src="/insights/js/lib/jquery.min.js"></script>
<script>
	$('iframe:not(#idEmbed)').prop('width', $('.DashboardPageContentDiv').width()-25);
	$('iframe:not(#idEmbed)').prop('height', $('.DashboardPageContentDiv').height()-45);
</script>
```

# URL Navigation

This is the equivalent to [Go URLs](http://gerardnico.com/wiki/dat/obiee/go_url) in vanialla OBIEE. The main view page (`/insights/app/states/view/view.html`) can be used to display any API dashboard with options for download. The URL accepts a [query string](https://en.wikipedia.org/wiki/Query_string) parameter, `db` to the web catalogue path. For example, a report called *Test* saved in the shared folder (`/shared/Test`) can be accessed by:

```
/insights/app/states/view/view.html?db=%2Fshared%2FTest
```

Note that the path has been URI [encoded](http://meyerweb.com/eric/tools/dencoder/). Most modern browsers will do this automatically, but it can be safer to enter an encoded URI.

## Passing filters via URL

> Currently this only supports passing filters to **dashboard prompts**.

URL query string parameters can be used to override the default values of dashboard prompts. Any number of filters can be applied, requiring two parameters per filter. The syntax is shown below, where `n` is the filter index, e.g. 1 for the first, 2 for the second, etc.

* `filtern`: The column ID to override in the format `<Presentation Table>.<Presentation Column>`. E.g. `Products.Product Type`. Note that `"` are not required.
* `valn` : The value corresponding to the filter. To pass numerous values, separate by `;`.
* `opn` : Optional (defaults to `in`) operator to override the prompt with, which can take values of:
	* `in`
	* `notIn`
	* `greater`
	* `greaterOrEqual`
	* `less`
	* `lessOrEqual`
	* `top`
	* `bottom`
	* `isNull`
	* `isNotNull`

### Example

Dashboard `/shared/Test` has dashboard prompts for **Product Type** and **Company** with some default values set. We would like to override them so that the type has values *Audio* and *LCD* and the company is *not* *Tescare Ltd.*. There are two filters required:

* `filter1`: `Products.Product Type`
* `val1`: `Audio;LCD`
* `filter2`: `Offices.Company`
* `val2`: `Tescare Ltd.`
* `op2` : `notIn`


The final query string looks as follows:

```
http://rmdev:9502/insights/app/states/view/view.html?db=%2Fshared%2FTest&filter1=Products.Product%20Type&val1=Audio;LCD&filter2=Offices.Company&val2=Tescare%20Ltd.
```

### Passing URL to embedded content in OBIEE

Query string parameters from a URL cannot be read from iframes and so they must be dynamically passed to the content. This can be achieved by using some JavaScript that can be saved as a Static Text view in an analysis. The required code is presented below. This assumes only one iframe on the dashboard.

```html
<script src="/insights/js/lib/jquery.min.js"></script>
<script>
	var getQueryString = function(name) {
			name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
			var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
				results = regex.exec(location.search);
			return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
	}

	var getNumQueryString = function(search) {
			var query = window.location.search.substring(1);
			var vars = query.split('&').map(function(v) {
				return v.split('=');
			});
			var out = vars.filter(function(v) {
				return v[0].indexOf(search) == 0;
			});
			return (out.length);
		}

	var qs = '';
	for (var i=1; i <= getNumQueryString('filter'); i++) {
				var code = getQueryString('filter'+i);
				var op = getQueryString('op'+i);
				var val = getQueryString('val'+i);
				qs += '&filter' + i + '=' + code + '&val' + i + '=' + val;
			}

	var path = $('iframe:not(#idEmbed)').prop('src');
	$('iframe:not(#idEmbed)').prop('src', path + qs);
</script>
```

# Variables

There are three types of variables in OBIEE:

* Repository
* Session
* Presentation

The first two are server based and so are tied to the application itself and the web API merely reads these. The final one is implemented as a purely client side entity in both vanilla OBIEE *and* the web API.

## Presentation Variables

Presentation variables can be used in column formulae and they will be dynamically overridden at run time. They can be set by using dashboard prompts.

The syntax for presentation variables has been modified from standard OBIEE, but keeps the same basic format when used in column formulae:

```
@{<variable>}{<default>}{<option>}
```

The new addition is the `option` bracket which can be used to influence how multiple values are dealt with. When multiple values are fed to a presentation variable they are automatically comma separated, which can be problematic when using strings which require quoting when in formulae and logical SQL. It takes one of the three values:

* `all` *default* : This means that a comma separated list of values will be quoted outside of the whole string, e.g. `'England, Canada, Brazil'`.
* `each` : This means that a comma separated list of values will be quoted for each item, e.g. `'England', 'Canada', 'Brazil'`.
* `none`: The comma separated list will be just entered exactly as is, i.e. without any quotes.

There is a private function, `parsePresVars` in [`obiee.js`](http://rmdev:9502/insights/docs/api/obiee.js.html) which governs this behaviour.

The examples below are all equivalent to each other when used in a column formula, the variable name `testVar` with a default value of `'Test'`:

```
@{testVar}{Test}
@{testVar}{Test}{all}
'@{testVar}{Test}{none}'
```

# Appendix

## OBIEE Embedding JavaScript

Saving this script as HTML in an analysis will allow API dashboards embedded in OBIEE to dynamically scale to fit the page as well as accept URL strings.

```html
<script src="/insights/js/lib/jquery.min.js"></script>
<script>
	// Automatically scale iFrame to fit the page
	$('iframe:not(#idEmbed)').prop('width', $('.DashboardPageContentDiv').width()-25);
	$('iframe:not(#idEmbed)').prop('height', $('.DashboardPageContentDiv').height()-45);

	// Gets value of query string parameter
	var getQueryString = function(name) {
			name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
			var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
				results = regex.exec(location.search);
			return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
	}

	// Gets the number of query string parameters matching a search string
	var getNumQueryString = function(search) {
			var query = window.location.search.substring(1);
			var vars = query.split('&').map(function(v) {
				return v.split('=');
			});
			var out = vars.filter(function(v) {
				return v[0].indexOf(search) == 0;
			});
			return (out.length);
		}

	// Passes API specific query strings to the iFrame
	var qs = '';
	for (var i=1; i <= getNumQueryString('filter'); i++) {
				var code = getQueryString('filter'+i);
				var op = getQueryString('op'+i);
				var val = getQueryString('val'+i);
				qs += '&filter' + i + '=' + code + '&val' + i + '=' + val;
			}

	var path = $('iframe:not(#idEmbed)').prop('src');
	$('iframe:not(#idEmbed)').prop('src', path + qs);
</script>
```
