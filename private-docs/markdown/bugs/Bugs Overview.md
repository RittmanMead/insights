% Bugs Overview

# User Experience

This section is for issues where the required action is not considered intuitive and has room for UI design improvement.

* Saving
* Switching to dashboard mode
* Creating dashboards
* Filters should be as another tab section rather than on the left pane

# Features

## Managing Queries

Query management can **not** be done properly using this application. The requisite methods for viewing and cancelling server requests are not exposed to either logical SQL procedures or web services. There are possible workarounds using the presentation server but this certainly not recommended. See [this page](bugs/cancelling-queries.html) for further reading on the problem.

# Compatibility

## OBIEE

Using [`executeLSQL`](api-reference.html#obiee.executelsql) in versions prior to 11.1.1.9, will cause decimals to come through as integers. This is recognised by [Oracle](https://community.oracle.com/message/13232471) and while there is no publicly available patch, a backport can be requested via an SR with Oracle. This can be somewhat overcome by using using the XML query web service, but that in turn has some issues, regarding returning full result sets and error handling.

Additionally, versions prior to 11.1.1.9 will limit session/repository variable functionality. This is because the app relies on using [`NQSGetSessionValues('%')`](http://gerardnico.com/wiki/dat/obiee/odbc_function#nqsgetsessionvalues) to fetch all defined variables and their values. In older versions this function does not accept a wildcard and so does not allow retrieval of variables *without* knowing the variable name first. Variables can still be used by using the LSQL expression feature in the UI.

## AngularJS

The application has been built using [AngularJS](https://angularjs.org/), a web application framework developed by Google. The application stops functioning (interaction editing screens fail) when using the latest version (1.5.0). It is not clear as of yet what the issue is, but has been identified that the problem comes in with version 1.4.9. As such, 1.4.8 is being used until this problem can be resolved. Also, [AngularJS 2](https://angular.io/) has been released but is a significantly different framework that would require an almost total rewrite of the app.

## Browser

IE11 experiences some cosmetic issues regarding fade transitions on the screen. It is also expected that older versions of IE will not function correctly.

# Vanilla OBIEE Interoperability

The current setup as a client side deployment on Weblogic has some major limitations, due to the cookie sharing. If a user logs in using the web API first, this will cause vanilla OBIEE to fail as it attempts to retrieve resources from `analytics-ws` instead of `analytics`. The reverse situation where the user begins their session in vanilla OBIEE works successfully. If SSO has been configured on OBIEE, this bug could potentially be overcome.

# Client-side vs Server-side

## Rendering

There is a concern that processing the visualisations client side (in the browser) will eventually have a performance impact when using larger data sets. At the moment, the concern is limited as OBIEE already is poor at visualising large data sets and indeed the recommendation for reporting is to keep visualisations simple and clear. A possible workaround to this could be using R and Shiny servers to process vast amounts of data, particularly if we use an OBIEE web service integration as an R package.
