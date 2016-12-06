% Technical Overview

# Introduction

This application is a browser-based front end data visualisation application for use with OBIEE. It has been made using a JavaScript API for the [OBIEE web services](http://docs.oracle.com/cd/E21764_01/bi.1111/e16364/soa_overview.htm#BIEIT137) and [RM's Visual Plugin Pack](https://github.com/RittmanMead/Visual-Plugin-Pack-for-OBIEE). The application itself is also client side and is written using the [AngularJS](https://angularjs.org/) framework. Many of the visualisations have been written using [D3](https://d3js.org/).

# Components

## OBIEE API

One of the key features of the application is an API written in JavaScript (JS) for interfacing with the native OBIEE web service. Among other things, this allows for querying against the BI server from outside of the standard OBIEE front-end. This is done using an object orientated system which abstracts the various concepts involved when building reports, like columns, filters and queries. This then facilitates the ability to dynamically generate and manipulate logical SQL to be sent to the BI server. Vanilla OBIEE does a similar thing at the presentation server layer, using XML report documents as the input. The potential use for this is to build web applications which are powered by data obtained through the BI server, but not restricted by the standard web interface. The API has been documented in detail [here](api/module-obiee.html).

Reports and dashboards are saved in the web catalogue as dummy analysis objects. A whole Insights dashboard page including visualisation layout, interactivity and prompts are all stored in a single, hierarchical JSON structure. This JSON is put into a Static Text view of an OBIEE analysis. Upon loading, this JSON object is read back out from the analysis and is parsed by the Insights API. The analyses in OBIEE are tagged as hidden, so won't display in the vanilla application by default.

### Session Management

Each call to the web interface requires a unique OBIEE [session ID](https://rittmanmead.atlassian.net/wiki/display/TEC/Session+routing+in+a+scaled-out+OBIEE+cluster) to execute successfully. This is performed using [`obiee.logon`](#obiee.logon) which will create a session on the OBIEE server and save the ID to a HTML5 [session storage](http://www.w3schools.com/html/html5_webstorage.asp) object in the users browser.

The script will search for an existing cookie that may have been created by OBIEE, `ORA_BIPS_NQID` and will use that if found.

In order to access this cookie, the OBIEE presentation server must be configured to deliver accessible cookies. To do this, edit `instanceconfig.xml` and add the following element under `Server`. Adding the `CookiePath` tag will ensure that the cookie can be read/set when navigating from vanilla OBIEE page. This also allows SSO configuration (e.g. with Kerberos) to work if configured for vanilla OBIEE.

```xml
<Security>
	<!-- Leave any other server tags as they are-->
	<HttpOnlyCookies>false</HttpOnlyCookies>
	<CookiePath>/</CookiePath>
</Security>
```

> **Warning:** Doing this may be considered a security risk at some tighter organisations as it allows cookies to be [read by the browser](https://www.owasp.org/index.php/HttpOnly). Providing [SSL](https://www.digicert.com/ssl.htm) is enabled, the increased risk is minimal, but should be noted.

Calling [`obiee.logoff`](api/module-obiee.html#.logoff) will end the users session and delete the ID from local storage. Additionally it will delete the `ORA_BIPS_NQID` cookie created on the `/analytics-ws` path at logon.

## Insights UI

Most of the UI has been developed using [AngularJS](https://angularjs.org/). Many Angular directives have been written for this application and each main page has its own controller. Shared functions and configuration (e.g. colours) are stored in a global service. All of the application code is found in the `app` directory tree. The application has three pages, each serving a specific purpose.

* `/insights` : Login page/homepage
* `/insights/app/states/visBuilder` : Dashboard creator page
* `/insights/app/states/view` : View saved dashboard pages

The view and creator pages can be [configured](api/module-obiee.html#.SecurityConfig) to be viewed *only* when the user's session has a given OBIEE application role. By default they are both configured to `AuthenticatedUser` so any legitimate OBIEE user can use either page.

In addition to the Angular app, there are a number of important functions in [`js/insights.js`](api/module-insights.html). This is legacy rather than design and eventually refactoring these into the directives and services may be desirable.

## RM Visual Plugin Pack

The application has been integrated with the plugin framework written by [Tom Underhill](https://github.com/RittmanMead/Visual-Plugin-Pack-for-OBIEE). This is used to provide all of the visualisations available to the application. However, unlike the original plugin, there is no need to edit anything with the vanilla OBIEE installation. [`rmvpp.js`](api/module-rmvpp.html) contains functions to manage plugins as well as draw SVG/HTML elements. Additionally there are prototypical extensions for JavaScript and associated modules in this file.

The framework has been devised in such a way as to be agnostic to the app itself. As such, plugins can be included/excluded simply. All of the plugins are found in `plugins`, each plugin contained in its own subfolder with any additional dependencies required. To add or remove plugins, simply add or remove the JavaScript includes on the application pages (`visBuilder/index.html` and `view/index.html`).

# Documentation

Most of the application is contained in the Git repository and developers can start making UI and plugin modifications straight away. However there are a few dependencies required to regenerate the documentation. This is because much of the documentation is automatically generated from parsing the JavaScript code. Other files are specially converted and formatted [markdown](https://en.wikipedia.org/wiki/Markdown) documents. Once the prerequisites are installed, `/insights/private-docs/gendoc.py` can be executed to regenerate all documentation files.

## Pre-requisites

* [Python 2](https://www.python.org/downloads)
* [Pandoc](http://pandoc.org/)
* [Node JS](https://nodejs.org/en/)
* [JSDoc](http://usejsdoc.org/)
	* Note that JSDoc needs a basic [configuration JSON](http://usejsdoc.org/about-configuring-jsdoc.html) set up before it will work.

## General Documents

General documentation (like this page) is written in markdown and stored in `private-docs/markdown`. Changing or adding markdown files in this directory structure will cause them to be added to the same structure in `/insights/docs` upon generation. Additionally, files are added to the index which is alphabetically sorted.

## API Reference

This is produced using JSDoc which parses the JavaScript files for code and comments. The special [comments](http://usejsdoc.org/about-getting-started.html) define what is precisely documented. As such, it is pertinent to make sure any public functions have all of their parameters and purposes described. Classes are also described in this way. Then these comments are parsed and documentation pages are indexed and created.

## Plugins

The plugins are automatically documented as well but do not use JSDoc and so there are no need for special comments in these files. Instead, NodeJS is used to parse the JavaScript and description properties in the plugin parameters are used to produce the documentation automatically. Also, an alphabetically sorted index page is created. In order for this functionality to work, a screenshot of the plugin should be provided in the `private-docs/images/plugins` directory. The name of this PNG file should exactly match the plugin ID, e.g. `pivot-table.png`.

# Limitations

## Hard Limitations

As a client side application which relies on the OBIEE web services there are some fundamental limitations to the application. These are limitations that can't be overcome without using a server side technology, something that is out of the scope of this project.

* **Data Mashups:** While it is technically possible to write a plugin that could combine other data sources temporarily, there is no mechanism to upload files, so none of these external data sources could be saved. It may be possible to use the Visual Analyzer mashup API to do this, but is not yet something I have investigated.
* **Agents:** There is no functionality to send reports created with Insights to users via e-mail or any other means. Without a server-side technology there would be no way of embedding the content to an e-mail. However, it would be possible to design a system whereby links to Insights dashboards were sent in e-mails, but this is less useful.
* **Cancelling Queries:** There are no exposed methods to cancel a running query once it has been executed.

## Soft Limitations

These limitations are technically possible within the framework's design but are yet to be implemented. 

* **Multiple Subject Areas:** Visualisation queries are currently limited to one subject area. The logical SQL for multiple subject areas is not complex, only the `SELECT` clause is altered. At the moment dashboard prompts and visualisations automatically affect any visualisations from the same subject area. This is complicated by the use of multiple subject areas but shouldn't be wholly incompatible.

# Appendix

## OBIEE Web Services

OBIEE has a native [web service](http://docs.oracle.com/cd/E21764_01/bi.1111/e16364/soa_overview.htm#BIEIT137) which can be interfaced with to perform standard operations. The formal definitions of the web services can be found in the hosted WSDL document:

```
http://host:port/analytics/saw.dll/wsdl/v8
```

The API has functions to manage sessions, retrieve metadata and execute reports. The reports are all executed against an existing session so that any appropriate security  is applied.

Above is the link for version 8 of the WSDL, but newer versions exist on patched OBIEE implementations. For example, version 10 of the WSDL exists on 11.1.1.9.1. Typically, OBIEE will respect historic versions as well and many of the functions do not change their SOAP implementation across upgrades, allowing for easy translation of code.

Each `js` file contains a library of functions to build and execute SOAP messages, which effectively parametrised `xml` function calls. To convert one version to another, find and replace the version numbers, e.g. `v8` with `v10`.

# Dependencies and Compatablity

**Web App Version:** 1.0

## JavaScript Libraries

The following JavaScript libraries are included with this version of the app. Core libraries are found in `js/lib` and any libraries specific to plugins will be found in a `lib` sub-folder for that plugin. E.g. `plugins/table/lib`. At time of writing all libraries are open source, most under a MIT license but that can be checked for each added file.

Name | File | Version | Size (kb) | Additional Comments
--- | --- | --- | --- | --- | ---
[AG Grid](https://www.ag-grid.com/) | `ag-grid.min.js` | 4.0.6 (Custom) | 351 | JavaScript table library, used for the *Table* plugin.
[AngularJS](https://code.angularjs.org/1.5.3/) | `angular.min.js` | 1.5.3 | 146 | Core application framework.
[Angular Animate](https://code.angularjs.org/11.5.3/) | `angular-animate.min.js` | 1.5.3 | 26 | Enables CSS animations.
[Angular Aria](https://docs.angularjs.org/api/ngAria) | `angular-aria.min.js` | 1.5.3 | 4 | Improves accessibility and requisite for Angular Material.
[Angular Material](https://material.angularjs.org/latest/) | `angular-material.min.js` | 1.1.0 | 298 | UI framework from Google.
[Angular Material Colour Picker](https://github.com/brianpkelley/md-color-picker) | `md-colour-picker.min.js` | v0.2.6 | Angular Material style colour picker.
[Angular Messages](https://docs.angularjs.org/api/ngMessages/directive/ngMessages) | `angular-messages.min.js` | 1.5.3 | 3 | Form validation and requisite for Angular Material.
[Angular Modal Service](https://github.com/dwmkerr/angular-modal-service#usage) | `angular-modal-service.min.js` | 0.6.9 | 2 | Enables modal UI feature.
[Angular Sortable View](https://github.com/kamilkp/angular-sortable-view) | `angular-sortable-view.min.js` | 0.0.13 | Enables list sorting in the UI.
[Angular Selection Model](https://github.com/jtrussell/angular-selection-model) | `angular-selection-model.min.js` | 0.10.2 | 5 | Enables pick-lists in the UI.
[D3](https://d3js.org/) | `d3.min.js` | 3.5.16 | 148 | Data visualisation JavaScript library.
[D3 Layout Cloud](https://github.com/jasondavies/d3-cloud) | `d3.layout.cloud.min.js` | N/A | 5 | D3 plugin for word arrangement. Used for the *Word Cloud* plugin.
[D3 Sankey](https://github.com/d3/d3-plugins/tree/master/sankey) | `d3.sankey.min.js` | N/A | 3 | Sankey D3 plugin, used for the *Sankey Chart* plugin.
[Fabric JS](http://fabricjs.com/) | `fabric.min.js` | 1.5.0 | 214 | Used for SVG to canvas conversion for `PNG` and `PDF` exports.
[Font Awesome](http://fortawesome.github.io/Font-Awesome/) | `/icons` | 4.6.0 | 920 | Used for CSS class icons throughout the application.
[Font Detect](http://www.lalit.org/lab/javascript-css-font-detect/) | `fontdetect.js` | 0.3 | 3 | Detect if fonts are available.
[FileSaver JS](https://github.com/eligrey/FileSaver.js/) | `FileSaver.min.js` | N/A | 5 | Used to save files from the browser. Also includes [canvas-toBlob](https://github.com/eligrey/canvas-toBlob.js).
[HTML2Canvas](https://html2canvas.hertzen.com/) | `html2canvas.min.js` | Custom | 35 | Used to convert HTML elements to SVG for `PNG` and `PDF` exports.
[Interact JS](http://interactjs.io/) | `interact.min.js` | 1.2.4 | 61 | Enables dragging and dropping in the UI.
[jQuery](https://jquery.com/) | `jquery.min.js` | 1.11.3 | 94 | JavaScript helper library.
[jQuery UI](https://jqueryui.com/) | `jquery-ui.min.js` | 1.11.4 | 55 | UI library with core, widget, draggable, droppable, resizeable and mouse modules.
[jQuery XML to JSON](http://www.fyneworks.com/jquery/xml-to-json/) | `jquery.xml2json.min.js` | 1.3 | 2 | Plugin for jQuery to convert XML to JSON.
[JS PDF](https://parall.ax/products/jspdf) | `jspdf.min.js` | N/A | 16 | Enables PDF exporting.
[JS Zip](https://stuk.github.io/jszip/) | `jszip.min.js` | N/A | 74 | Allows reading/writing of `zip` files client side.
[Leaflet JS](http://leafletjs.com/) | `leaflet.min.js` | 0.77 | 123 | JavaScript mapping library.
[Leaflet Heat](https://github.com/Leaflet/Leaflet.heat) | `leaflet.heat.min.js` | N/A | 6 | Heatmap plugin for Leaflet. Used for the *Map (Heatmap)* plugin.
[Leaflet MarkerCluster](https://github.com/Leaflet/Leaflet.markercluster) | `leaflet.markercluster.min.js` | N/A | 29 | Map point clustering plugin for Leaflet. Used for the *Map (Cluster)* plugin.
[Leaflet PIP](https://github.com/mapbox/leaflet-pip) | `leaflet.pip.min.js` | N/A | 7 | Allows point in polygon functionality with Leaflet.
[Modernizr](https://modernizr.com) | `modernizr.min.js` | 3.3.1 | 3 | Detects if scrollbar is hidden, e.g. on OSX. Can be extended to detect other web features.
[Protobi JS-XLSX Beta](https://github.com/protobi/js-xlsx/tree/beta) | `xlsx.core.min.js` | Beta | 410 | Use ProtoBI beta version instead of the [standard library](https://github.com/SheetJS/js-xlsx). This allows custom formatting in the Excel sheet but adds JS Zip as a dependency.
[Pivot JS](http://nicolas.kruchten.com/pivottable/examples/) | `pivot.min.js` | Custom | 33 | Customised JavaScript pivot table library. Used for the *Pivot Table* plugin.
[Tiny Color](https://github.com/bgrins/TinyColor) | `tinycolor.min.js` | 1.3.0 | 19 | Colour manipulation library required for the Material colour picker.
[TopoJSON](https://github.com/mbostock/topojson) | `topojson.min.js` | 1.6.24 | 7 | Allows reading of TopoJSON layer format which is more efficient than GeoJSON.

## Compatibility

The following software versions have been tested against this version of the app.

### OBIEE

OBIEE has been tested using SSL and SSO configured with Kerberos.

#### Fully Functional

* 12c
	* 12.2.1.0.160419
	* 12.2.1.0.0
* 11g
	* 11.1.1.9.160419
	* 11.1.1.9.0

#### Limited Functionality

* 11.1.1.7.140715
	* [Decimals](bugs-and-limitations.html#obiee) are not returned by the web service.
	* Limited use of [repository/session variables](bugs-and-limitations.html#obiee).

### Browser

#### Fully functional

* Google Chrome
	* 50.0.2661.94
	* 49.0.2623.110
* Internet Explorer
	* 11.0.9600.18097
	* 11.0.9600.18282

#### Limited Functionality

* Safari
	* 9.0.2 (11601.3.9) : PDF/PNG export unavailable.

## Disk Space

* Total repository: 25.7MB
* Web application: 5.67MB
* Documentation: 8.44MB
* Maps: 7.88MB
