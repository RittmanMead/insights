% Developing Plugins

# Introduction and General Properties

This guide is an introduction and reference for developing and modifying plugins for use with the Insights framework. Plugins are defined as properties in the `rmvpp.Plugins` object. The framework expects a plugin object to have certain parameters which are consumed by the application, allowing a flexible but standardised format for the UI. Similarly, it helps to standardise the input passed to the [rendering](#rendering) function for the benefit of plugin developers.

`pluginName` is the property in the umbrella `rmvpp.Plugins` object that will reference the plugin, e.g. `'bar'` and `rmvpp.Plugins.bar`. It is declared at the top of the and used to assign all other properties, but not used for display. This is the object that defines a plugin, all subsequent attributes in this section are properties of this main object.

* `displayName` : Display name for the plugin. E.g. `'Bar Chart'`.
* `description` : Description of the plugin to be used for documentation. Supports [markdown](https://en.wikipedia.org/wiki/Markdown) syntax.
* `icon` : [Font Awesome](http://fontawesome.io/icons/) icon code to display in the UI when the plugin is being. used.

## Adding/Modifying Plugins

New plugins can be developed by adding properties to this object, and providing they are in the correct format, they will be consumed by the application. A template for designing plugins can be found at `plugins/template.js`, or any of the existing files can be copied and modified. It is recommended that modifications to plugins are made by copying the original files first and changing the `pluginName`. This will ensure that any changes you make are not lost if you update the application repository.

Plugin files are stored in `/insights/plugins` and each plugin has a directory of its own, with the same name as as the pluginName. This directory should contain:

* `<pluginName>.js` : Main plugin file with the properties and functions described in this document.
* `doc.md` : Markdown documentation for the plugin. Any images for the document should also be contained in this directory. If it exists, the file will be automatically read during [documentation creation](/insights/docs/technical-overview.html#documentation) and a HTML document produced at `/insights/docs/plugins/<pluginName>.html`
* `lib/*` : Directory containing any `js` or `css` specific only to this plugin. A full summary of *all* modules and libraries included in Insights can be found [here](/insights/docs/technical-overview.html#javascript-libraries).

To add a new plugin to the application, the scripts and associated CSS and libraries need to be loaded in the two application pages:

* `/insights/app/states/visBuilder/index.html`
* `/insights/app/states/view/index.html`

The include tag can be added to the header in the same location as the other plugin includes. E.g.

```html
<head>
	<!-- Bar Chart -->
	<script src="/insights/plugins/bar/bar.js"></script>
</head>
```

# Rendering

Each plugin has a `render` property which specifies the function to execute when loading a visualisation based on that plugin. The render function of all plugins will receive the same arguments (in this order):

* `data` : Array of objects describing the data received from OBIEE. Each element will have property names for each property in described by the [column map](#column-mapping). Single columns will have the value assigned directly to that property. Multiple columns will have an array of objects with `name` and `value` properties. The order of items in this sub-array will match the order defined in the column map. The data set will be sorted in the the columns appear in the dataset. Additionally, each row will also have a property of the true column name (from OBIEE) with the value for that cell, providing a flattened view of the row even when 'multiple' columns types are used.
* `columnMap` : Object describing the [column mapping](#column-mapping) between columns in OBIEE and the custom visualisation. This allows the plugin developer to use properties of the [OBIEE columns](/insights/docs/api/module-obiee.BIColumn.html) when rendering the visualisation.
* `config` : Object describing the [configuration](#configuration) for the plugin. This lets the user vary parameters (size, colour etc.) and gives the values in a structured way for the plugin developer to use.
* `container` : HTML DOM element to act as the container for the visualisation. It is very important that a plugin developer uses this container as a parent frame of reference when doing **any** rendering or DOM manipulation. This will ensure that code for your given plugin does not affect anything else in the application.
* `condFormats` : Array of [`conditional format rules`](/insights/docs/api/module-obiee.BIConditionalFormat.html) defined by the user. Can be used by the plugin developer to dynamically [format](#conditional-formatting) elements of their visualisation based on the data.

# Column Mapping

The `columnMappingParameters` property is array of objects defining column mapping between OBIEE and the custom visualisation. It acts as a way of the plugin developer communicating to the user which kind of columns should go where to achieve certain results. For example a bar chart has an category axis (usually X) and measure axis (usually Y). A user might select 'Product' to be the category and 'Revenue' to be the measure. The column map will tell them which is which.

When passed to the [`render`](#rendering) function, the column map is an object of properties described by this configuration, and values of [`obiee.BIColumn`](/insights/docs/api/module-obiee.BIColumn.html) objects chosen by the user.

## Column Map Properties

* `targetProperty` : The name of the property the data should be mapped to. Target properties **cannot** end in numbers, as this logic is reserved for handling multiple columns.
* `formLabel` : A description to be used by the UI to display a column map.
* `type` : Designates the type of column. Can take one of the following values:
	* any
	* fact
	* dim
	* hidden
* `desc` *optional* : Description for the column mapping parameter. Will be used to generate documentation and in the UI. Supports [markdown](https://en.wikipedia.org/wiki/Markdown) syntax.
* `multiple` *optional* : Boolean property allowing mapping to be an array of multiple columns, rather than a one to one mapping. If this is set to true, `mapData` will create a new property on the row, with the `targetProperty` value, holding an array of `name` and `value` pairs for each selected column. This is useful in some rendering contexts, e.g. multiple series on charts.
* `required` *optional* : Boolean property indicating whether or not this column is mandatory for producing the visualisation.
* `conditionalFormat` *optional* : Boolean or string property indicating whether or not this column can have conditional formatting applied to it. Note that all columns can be used for logic in conditional format rules regardless of this property. Declaring as a string will allow further options. Currently the only available option is to set the value to `icon`, which will allow icon picking in the UI. In future, other options can be added by making this value a comma separated list.
* `config` *optional* : Array of objects using the same structure as [`configurationParameters`](#configurationparameters). These allow for column specific configuration for example, column widths on the table plugin. Parameters are assigned to the `Config` property of the columns in the column map when the viaulisation is rendered.

## Example

```javascript
rmvpp[pluginName].columnMappingParameters = [
	{
		targetProperty:"x",
		formLabel: "X Axis",
		required: true
	},
	{
		targetProperty:"y",
		formLabel: "Y Axis",
		required: true,
		conditionalFormat: true,
		multiple: true,
		config : [
			{
				targetProperty:"hide",
				label: "Hide",
				inputType: "checkbox",
				inputOptions: {
					"defaultValue": false
				}
			}
		]
	}
];
```

# Configuration

The `configurationParameters` property is array of objects defining configuration settings. These settings most importantly contain the key-value properties to be passed through to the [rendering](#rendering) function, allowing a plugin developer to parameterise their visualisations. This must include properties for sizing, but can include any other parameters like colour, fonts, axes titles etc.

The framework assumes all visualisations have a fixed height and width, which allows resizing and dynamic scaling but places some constraints on some configuration parameters. A plugin **must** have one of the following configuration properties:

* `size` : Assumes a maintenance of aspect ratio.
* `width` and `height` : Two properties indicating the size.

Note that these properties do **not** require the `scalable` attribute to be set and will scale automatically.

Additionally, the options here affect the user interface generated as custom UI elements can be provided. This UI is governed by the `inputType` property which in turn dynamically calls an Angular template from `app/directives/templates/config/config-<inputType>.html`. This template can then call other directives as required.

## Properties

* `targetProperty` : Name of the property to assign the value to in the resulting config object.
* `label` : Description to be used by the UI to display the configuration option.
* `inputType` : Type of input. Each of these has various sub properties available. The full list of input types is below.
* `inputOptions` Specific options for the type of input chosen. Details for each type in the following subsections.
* `scalable` *optional* : String with the allowable values: `size`, `width` or `height`. This scales a custom attribute based on the screen resolution upon loading. Choose `width` will scale based on the change in width of the screen and similarly for `height`. Choosing `size` will scale on the mean of the width and height ratios.
* `desc` *optional* : Description for the configuration parameter. Will be used to generate documentation and in the UI. Supports [markdown](https://en.wikipedia.org/wiki/Markdown) syntax.

## Configuration Types

### `textbox`

Standard HTML5 text input, defaults to the `text` subtype.

**Input Options**

* `subtype` : HTML5 text input types, including:
	* `text` : Normal alphanumeric text input.
	* `number` : Restricts to numeric input
* `min` : Minimum value for dates and numbers
* `max` : Maximum value for dates and numbers
* `defaultValue` : **String** containing the default value

**Example**

```javascript
{
	targetProperty:"test",
	label: "Test",
	inputType: "textbox",
	inputOptions: {
		subtype : 'number',
		"min" : 0,
		"max" : 10,
		defaultValue : 5
	}
}
```

### `checkbox`

Standard checkbox input for binary parameters.

**Input Options**

* `defaultValue` : **Binary**, either `true` or `false`

**Example**

```javascript
{
	targetProperty:"test",
	label: "Test",
	inputType: "checkbox",
	inputOptions: {
		defaultValue : true
	}
}
```

### `radio`

Radio buttons to choose a single value from an array of choices.

**Input Options**

* `values` : Array of strings for possible values to select from. One of these will be selected and passed through to the config object.
* `defaultValue` : One of the values defined above.

**Example**

```javascript
{
	targetProperty:"test",
	label: "Test",
	inputType: "radio",
	inputOptions: {
		"values" : ['Option 1', 'Option 2'],
		defaultValue : 'Option 2'
	}
}
```

### `dropdown`

Dropdown supporting single or multiple value select. Single choice will give a string, similar to a radio button, multiple select will allow for arrays to be selected.

**Input Options**

* `multiSelect` : Binary value allowing multiple values to be selected.
* `values` : Array of strings for possible values to select from.
* `defaultValue` : **String** if `multiSelect == false`, **Array** otherwise.

```javascript
{
	targetProperty:"test",
	label: "Test",
	inputType: "dropdown",
	inputOptions: {
		'multiSelect' : true,
		"values" : ['Option 1', 'Option 2', 'Option 3', 'Option 4', 'Option 5'],
		defaultValue : ['Option 2', 'Option 3']
	}
}
```

### `date`

Uses an Angular [datepicker](https://github.com/720kb/angular-datepicker) to allow the user to choose a date intuitively. Stores a date value in YYYY-MM-DD format.

**Example:**

```javascript
{
	targetProperty:"test",
	label: "Test",
	inputType: "date"
}
```

### `dateRange`

Provides two [datepicker](https://github.com/720kb/angular-datepicker) inputs to allow a user to select two dates which are constrained as a range. That is the first date has to be before the latter. Stores two dates in YYYY-MM-DD in a two-element array.

**Example:**

```javascript
{
	targetProperty:"test",
	label: "Test",
	inputType: "dateRange"
}
```

### `range`

Creates a range input for selecting a number between two values.

**Input Options**

* `min`
* `max`
* `step` : Amount to increment on the slider, defaulting to 1
* `defaultValue` : Number

**Example**

```javascript
{
	targetProperty:"test",
	label: "Test",
	inputType: "range",
	inputOptions: {
		"min" : 5,
		"max" : 50,
		"step" : 0.01,
		defaultValue : 25
	}
}
```

### `colour`

[Colour picker](http://colpick.com/plugin) allowing users to select from a rich colour palette.

**Input Options**

* `defaultValue` : String with a Hex value of the colour.

**Example**

```javascript
{
	targetProperty:"test",
	label: "Test",
	inputType: "colour",
	inputOptions: {
		defaultValue : '#0095FF'
	}
}
```

### `icon`

Provides an picker interface to choose one of any [Font Awesome](http://fontawesome.io/icons/) icon.

**Input Options**

* `defaultValue` : String indicating the icon class.

**Example**

```javascript
{
	targetProperty:"icon",
	label: "Icon",
	inputType: "icon",
	inputOptions: { "defaultValue": "arrow-up"	}
}
```

### `font`

Provides a dropdown of available fonts from the master list in `InsightsConfig.Fonts`.

**Input Options**

* `defaultValue` : **String** indicating the font name.

**Example**

```javascript
{
	targetProperty:"font",
	label: "Font",
	inputType: "font",
	inputOptions: { "defaultValue": "Open Sans"	}
}
```

### `palette`

Allows a dynamic list of colours to be chosen from and edited. Preset palettes are defined in `InsightsConfig.Palettes`. Users are not restricted to the presets however, they can manually edit the palette as a series of colour pickers using the interface provided.

**Input Options**

* `defaultValue` : **String** with a preset palette property in `InsightsConfig.Palettes`.

**Example**

```javascript
{
	targetProperty:"test",
	label: "Test",
	inputType: "palette",
	inputOptions: {
		defaultValue : 'Flat-UI'
	}
}
```

### `map`

Creates a map picker which shows previews of TopoJSON files that have been uploaded to the server and added to `InsightsConfig.Maps`. This is a list of objects describing the URL to the TopoJSON file and the name that should be presented to the user. The value stored by the picker will be the *URL* to the TopoJSON file and hence ultimately sent to the plugin, but the name will be shown in the display.

**Example**

```javascript
{
	targetProperty:"topojson",
	label: "TopoJSON File",
	inputType: "map",
	desc: 'TopoJSON file existing in the `topojson` directory.'
},
```

### `mapcode`

Special dropdown that is tied to a `map` picker showing the possible feature properties the user can use from that TopoJSON file. When the map picker is used and the map is changed, this dropdown will update automatically.

**Input Options**

* `mapProperty`: Name of the `map` picker configuration property that should drive the feature property dropdown.

**Example**

```javascript
{
	targetProperty:"featureCode",
	label: "Feature Code",
	inputType: "mapcode",
	inputOptions: { "mapProperty": 'topojson' },
	desc: 'TopoJSON attribute linking the OBIEE dataset to the map.'
}
```

### `maptile`

Picker for map imaging layers that have been defined in `InsightsConfig.MapTiles`. The images for these maps are obtained dynamically depending on the position and zoom. This uses [Leaflet](http://leafletjs.com/) which is an open source equivalent to services like Goolge Maps. The picker lets you see a preview of what the tile layer will look like.

**Input Options**

* `defaultValue`: Default setting for the tile layer. Setting this to `Default` will use the property `InsightsConfig.DefaultMapTile`.

**Example**

```javascript
{
	targetProperty: "mapTile",
	label: "Map Tiles",
	inputType: "maptile",
	inputOptions: { "defaultValue": "Default" },
	desc: 'Defines the images used for the map background in the plugin.'
}
```

# Interactivity

## Actions

The `actions` property is an array defining what the possible interaction triggers available for the visualisation. For example clicking on a bar in a bar chart or hovering over a row on the table. Data can be passed dynamically through that interaction allowing filtering and other customisable actions. The information declared here tells the UI what interactions are possible

The function [`rmvpp.createTrigger`](/insights/docs/api/module-rmvpp.html#.createTrigger) declares such an action on a plugin when used in the [`render`](#rendering) function. The arguments required are as follows:

* `pluginName` : ID [property](#general-properties) for the plugin.
* `columnMap` : Column map passed to the [`render`](#rendering) function.
* `container` : HTML DOM element passed to the [`render`](#rendering) function.
* `event` : Name of the event as declared in the `actions` array.
* `datum` : One or more row objects in the format passed to the [`render`](#rendering) function.

### Properties

* `trigger` : Custom JavaScript event to trigger on a certain interaction (described by `type`). The name of the event should ideally describe the action, e.g. `barClick`. It is up to the plugin developer to ensure that the event is fired at the correct time, by using `rmvpp.createTrigger` in the `render` function as described above.
* `type` : Type of regular [JavaScript event](http://www.w3schools.com/js/js_events.asp), e.g. `click`, `mouseover`.
* `output` : Array of [column map](#column-mapping) properties that indicate what possible data will be passed in the interaction. When a user is defining an interaction in the UI, they will be given a list of all *attribute* (not measure) columns that are mapped to these properties visualisation.
* `description` : Text description of the interaction behaviour to be displayed to users in the UI.

### Example

```javascript
rmvpp.Plugins[pluginName].actions = [ // Action definitions
	{
		'trigger' : 'barClick',
		'type' : 'click',
		'name' : 'Click - Bar',
		'output' : ['category', 'vary'],
		'description' : 'Click on a bar to pass columns and values.'
	}
];

rmvpp.Plugins[pluginName].render = function(data, columnMap, config, container, condFormats)   {
	// Code to render the visualisation...
	var bars = xGroups.selectAll('g') // D3 selection...
		.on("click", function(d, i) { // Click handler...
			rmvpp.createTrigger(pluginName, columnMap, container, 'barClick', d); // `d` describes the datum bound by D3
		});
}
```

## Reactions

The `reactions` reactions property is an array defining what possible reactions are available for the visualisation. This is a response to the actions described above. Reactions are split into two main categories: general and private. General reactions are defined globally (and hence can be applied to any plugin) by [`insights.generateHandler`](/insights/docs/api/module-insights.html#.generateHandler). As of version 1.0, the only general reactions are:

* `filter` : Queries OBIEE again, filtering for the columns provided.
* `log` : Sends the output to the console. Used for debugging only.

Private handlers are defined as properties on the plugin itself. The ID used for a private handler should be a the name of the function defined on the plugin.

### Properties

* `id` : Identifier for the handler that should be used.
* `name` : UI friendly name for the reaciton.
* `description` : Description of the reaction for displaying to the user.
* `type` : Enumeration of `general` or `private`.

### Example

```javascript
rmvpp.Plugins[pluginName].reactions = [
	{
		id : 'filter',
		name : 'Filter',
		description : 'Accepts a column map and value and filters the report if the subject area matches.',
		type : 'general'
	},
	{
		id : 'search',
		name : 'Search',
		description : 'Uses the Data Tables search facility to search for a value passed.',
		type : 'private' // Private reacion
	}
];

// Handler for private reaction. Name of the property matches the reaction ID.
rmvpp.Plugins[pluginName].search = function(output, container) {
	var searchVal = output.map(function(d) { return d.values.join(' '); }).join(' ');
	$(container).find('input.search').val(searchVal).trigger('keydown');
}
```

# Conditional Formatting

The framework allows conditional formatting instructions to be sent to the [`render`](#rendering) function, which can then be used by the plugin developer to customise styling in whichever way they choose. These instructions take the form of an array of [`BIConditionalFormat`](/insights/docs/api/module-obiee.BIConditionalFormat.html) objects which have properties and helper functions. The most important are described here, but a detailed description can be found in the API reference.

* `TargetID` : Column mapping property of the column to apply the formatting to. For multiple columns this will take the form `property+i` where `i` is the zero-based index of the multiple column. E.g. `columns0`, `columns3`. Also, a user may define conditional formatting for *all* the columns in a multiple parameter, in which case the target ID will simply be the property name, e.g. `columns`.
* `compare(datum)` : Tests the condition for a given row, returning `true` if passed. `datum` should be a single object from the `data` parameter passed to the [`render`](#rendering) function. Alternatively, a value (string or number) can be passed directly to this function to test it against the rule.
* `Style` : Describes the stylistic changes that should be applied.
	* `colour`
	* `icon` : [Font Awesome](http://fontawesome.io/icons/) icon to apply.

`specialCondFormats` is an array of objects defining specific conditional formats that can be applied only to this particular plugin. An example of this is the heat map formatting on the pivot table. The ID used for these formats **cannot** be the same as any in the list below as they are reserved by the generic conditional formatting framework:

* `equal`
* `notEqual`
* `greater`
* `greaterOrEqual`
* `less`
* `lessOrEqual`

## Properties

* `id` : ID for the conditional format, that should be unique compared to the defaults, which is the operator list `equal, notEqual...`
* `name` : Display name of the conditional format type to the user.
* `noValue` : Boolean that if true, will prevent the user from entering a specific value when configuring the conditional format.

### Examples

**Single column conditional formatting (measure tile)**

```javascript
rmvpp.Plugins[pluginName].render = function(data, columnMap, config, container, condFormats)   {

	// Loop over conditional format rules
	condFormats.forEach(function(cf) {
		if (cf.compare(data[0])) { // Only one data item to compare
			colour = applyStyle(cf); // Apply styling when true
		}
	});
}
```

**Multiple column conditional formatting (table)**

```javascript
rmvpp.Plugins[pluginName].render = function(data, columnMap, config, container, condFormats)   {
	// Code to render the visualisation...

	columnMap.columns.forEach(function(c, i) { // Loop through all `columns`

		var cellRenderer = function(params) { // This function called for each cell in the table
			// Get conditional format rule that should apply to all `columns`.
			var filterCF = condFormats.filter(function(cf) { return cf.TargetID == 'columns'; });

			// Add any conditional format rules that apply only to this column
			filterCF = filterCF.concat(
				condFormats.filter(function(cf) {
					return cf.TargetID == 'columns' + (i);
				})
			);

			// Process each conditional format rule
			filterCF.forEach(function(cf) {
				if (cf.compare(params.data)) { // Compare the data
					$(params.eGridCell).css({ // If the rule passes, change the colour and embolden
						'color' : cf.Style.colour,
						'font-weight' : 'bold'
					});
				}
			});
		};
	});
}
```

**Custom conditional formatting (pivot table)**

```javascript
rmvpp.Plugins[pluginName].specialCondFormats = [ // Special conditional format presets for this plugin
	{
		id: 'heatmap',
		name: 'Heatmap',
		noValue: true, // No comparison value is required
	}
];

rmvpp.Plugins[pluginName].render = function(data, columnMap, config, container, condFormats)   {
	// Code to render the visualisation...

	// Get special conditional formats
	var heatmaps = condFormats.filter(function(cf) {
		return cf.Operator == 'heatmap';
	});

	// Process them accordingly
	heatmaps.forEach(function(hm) {
		// Formatting actions
	})
}
```
