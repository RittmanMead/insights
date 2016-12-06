% System Configuration

Most of the application is self contained, but there are a few global configuration options available.

These options are configured in `js/config.js` which defines the global `InsightsConfig` object. This file will be overwritten when you pull updates from the Insights Git repository which will overwite any changes you make. As such, `js/customConfig.js` has been included on each page but is unversioned in the repository. If you create this file and override parameters in `InsightsConfig`, these changes will be kept even after updating the repository. As it is unversioned, `js/customConfig.js` needs to be created manually after you deploy the application to WebLogic.

Below is an example of the line required in `customConfig` to change the default locale to US.

```
InsightsConfig.Locale = 'US';
```

A full list of all configuration parameters in `InsightsConfig` can be found [here](/insights/docs/api/module-InsightsConfig.html).

# Security

All queries act through the BI server and are authenticated in the same way as OBIEE, so any row or object level security is maintained through OBIEE and the BI server as normal. However, pages of the Insights application can be optionally restricted to application roles.

`InsightsConfig.Security` has properties that correspond to roles in the Insight application. The value of each properties should be set to the respective OBIEE application role for granting that permission.

Insights Role | Description
--- | ---
`view` | Allows viewing of dashboards, specifically access to `/insights/app/states/view`
`create` | Allows creation of dashboards, specifically access to `/insights/app/states/visBuilder`

# Data Formats

The app uses the [D3 formatting](https://github.com/d3/d3-format) specification to format dates and numbers. The defaults for each data type can be modified by editing `InsightsConfig.DataFormats`. Additionally, numbers are formatting using SI prefixes. This is not always desirable, for example 1000,000,000 will be displayed as 1G rather than 1B. `InsightsConfig.SIPrefixes` can be modified to override these format prefixes to suit your needs.

# Managing Dashboards

Insights keeps a master list (JSON) of *all* published dashboard folders. This governs which dashboards are available on the [portal](/insights/app/states/portal) and contains the metadata for icons and tags for searching. This is stored as a hidden item in the catalogue at `/shared/RM-Insights/Published-Dashboards` which can be modified by anyone with the RM Insights `create` security role and read by anyone with the RM Insights `view` role. Migrating published dashboards is then simply a case of migrating this web catalogue item.

# Maps

## Tiles

All of the default map plugins use [LeafletJS](http://leafletjs.com/) and the [Open Street](https://www.openstreetmap.org/#map=5/51.500/-0.100) tile layer. This allows you to plot D3 objects with a dynamic and scalable map. The actual tile configurations are done in `rmvpp.js` and extend the `L.TileLayer` object to have properties matching the configuration in `InsightsConfig.MapTiles`. The Leaflet [tile layers](http://leafletjs.com/reference.html#tilelayer) specifications at minimum must include a `url` and `attribution`. As such you can change `InsightsConfig` to choose which tile layer Leaflet will use as default. The `Default` map layer is selected using the `InsightsConifg.DefaultMapTile` property.

## Features

Regional map features can be defined in Insights using [TopoJSON](https://github.com/topojson/topojson) files. `InsightsConfig.MapFeatures` is an array of objects describing locations (`path`) of TopoJSON files and descriptive names (`name`). Plugins like the [Choropleth]('/insights/docs/plugins/map-choropleth.html') allow the user to choose these map files and include them on their maps. You can add more features by uploading a new TopoJSON and appending to `InsightsConfig.MapFeatures` in `customConfig.js`.

# Look and Feel

The most general way to modify the style of the application is to add a custom CSS file to each of the HTML pages:

* `index.html`: Login page
* `app/states/portal/index.html`: Portal page
* `app/states/visBuilder/index.html`: Dashboard Builder
* `app/states/view/index.html`: Dashboard Viewer

Additionally, the app has been designed using Google's [Angular Material](https://material.angularjs.org/latest/) library. This means that most of the app follows a defined theme. Customisations to the [default themes](https://material.google.com/style/color.html#color-ui-color-palette) have been made at the top of `app/services/global.js`.

> **Note:** The app has not been perfectly refactored to Material directives yet, so a combination of Material theme changes and an additional CSS file must be used to fully customise the colours.

`InsightsConfig.UI` contains some more options for modifying the UI. There is a `Buttons` object which contains properties for optionally hiding certain UI elements. The only option currently available is to remove the sign out button, for SSO enabled environments.

## Styling the Documentation

The last thing that needs updating are the stylesheets for the documentation. The documentation is split into general documents and the automatically generated API reference. These have their own stylesheets and both need to be updated.

### Styling General Documents

An example CSS file is at `private-docs/styles/rm.css`. This can be used as a template when writing customisations but any new files **must** be saved in the same directory. To apply the modification, edit `private-docs/md_to_html.py` and uncomment lines 109 and 110. This should then read:

```python
custom_css = read_file(os.path.abspath("rm.css"))
write_output(custom_css, 'temp.css')
```

Make sure to replace `rm.css` with the name of your custom CSS file.

### Styling the API Reference

An example CSS file is at `docs/api/styles/rm-doc.css`. This can be used as a template when writing customisations but any new files **must** be saved in the same directory. Modify `docs/api/scripts/mod_doc.py` and uncomment line 209:

```python
head.insert(len(head), ET.XML('<link type="text/css" rel="stylesheet" href="styles/rm-doc.css"/>'))
```

Make sure to replace `rm-doc.css` with the name of your custom CSS file.

# Numeric To Double Conversion

Columns with a `NUMERIC` data types are automatically cast as `DOUBLE` to prevent a [reporting bug](bugs/numeric-data-type.html). This leaves reports potentially susceptible to rounding errors due to the  [floating point limitation](https://docs.oracle.com/cd/E28280_01/bi.1111/e10540/data_types.htm#BIEMG4605). The behaviour is controlled by `InsightsConfig.NumericToDouble` and so can be turned off at such a time as Oracle repair the issue with the web service.
