rmvpp = (function(rmvpp) {

    var pluginName = "pivot-table"
    rmvpp.Plugins[pluginName] = {};
    rmvpp.Plugins[pluginName].id = pluginName;
    rmvpp.Plugins[pluginName].displayName = "Pivot Table";
    rmvpp.Plugins[pluginName].description = "Pivot table created using a modified version of Nicolas Kruchten's [JS plugin](https://github.com/nicolaskruchten/pivottable). The pivot table has a fixed height and width and the content is scrollable both horizontally and vertical when necessary.";
	rmvpp.Plugins[pluginName].icon = "table";

    rmvpp.Plugins[pluginName].columnMappingParameters = [
		{
			targetProperty: "rows",
			formLabel: "Rows",
			multiple: true,
			type: 'any',
            desc: 'Attributes to be shown as rows in the pivot table. Can select multiple.'
		},
		{
			targetProperty: "columns",
			formLabel: "Columns",
			multiple: true,
			type: 'any',
            desc: 'Attributes to be shown as columns in the pivot table. Can select multiple.'
		},
		{
			targetProperty: "measures",
			formLabel: "Measures",
			multiple: true,
			type: 'fact',
			required: true,
			conditionalFormat: true,
            desc: 'Measures to display in the cells. Must be numeric measures that can be aggregated. Can choose multiple.',
			config: [
				{
					targetProperty: "aggregator",
					label:  "Default Aggregator",
					inputType:  "dropdown",
					inputOptions: {
						"multiSelect": false,
						"values": ["Count",
							"Count Unique Values",
							"List Unique Values",
							"Sum",
							"Integer Sum",
							"Mean",
							"Median",
							"Minimum",
							"Maximum",
							"Sum as % of Total",
							"Sum as % of Rows",
							"Sum as % of Columns",
							"Count as % of Total",
							"Count as % of Rows",
							"Count as % of Columns"
						],
						"defaultValue": 'Sum'
					},
                    desc: 'Aggregate function to use for the measure. E.g. Sum, Mean, Median.'
				},
				{
					targetProperty:"hide",
					label: "Hide Values",
					inputType: "checkbox",
					inputOptions: {
						"defaultValue": false
					},
                    desc: 'Hide the values of this measure from the table, but display totals.'
				}
			]
		},
		{
			targetProperty: "hidden",
			formLabel: "Hidden Measures",
			multiple: true,
			type: 'hidden',
            desc: 'Measures that are in the dataset but are not displayed in the table. This can be used for conditionally formatting rows based on certain columns.'
		},
	];

    rmvpp.Plugins[pluginName].configurationParameters = [
        {
			targetProperty:"width",
			label: "Width",
			inputType: "textbox",
			inputOptions: {
				subtype : 'number', "defaultValue": 300
			},
            desc: 'Width for the scrollable content of the table.'
		},
		{
			targetProperty:"height",
			label: "Height",
			inputType: "textbox",
			inputOptions: {
				subtype : 'number', "defaultValue": 300
			},
            desc: 'Height for the scrollable content of the table.'
		},
		{
			targetProperty:"columnWidth",
			label: "Column Width",
			inputType: "textbox",
			inputOptions: {
				subtype : 'number', "defaultValue": 100
			},
            desc: 'Fixed width of each column in the pivot table.'
		},
        {
            targetProperty: "controls",
            label:  "Allow Controls",
            inputType:  "checkbox",
            inputOptions: {
                 "defaultValue": true
            },
            desc: 'Allow the user to access the pivot control panel to move/exclude columns.'
        },
		{
            targetProperty: "valuesAsCols",
            label:  "Values as Columns",
            inputType:  "checkbox",
            inputOptions: {
                "defaultValue": true
            },
            desc: 'Boolean to choose to display value headings as columns or rows.'
        },
		{
			targetProperty: "renderer",
			label:  "Type",
			"inputType" : "radio",
			inputOptions: {
                "defaultValue": 'Table',
				"values":["Table", "Table Barchart"]
            },
            desc: 'Choose the rendering mode, table and table barchart available.'
		},
		{
            targetProperty:"themeColour",
            label: "Theme Colour",
            inputType: "colour",
            inputOptions: { "defaultValue": "#5DA5DA" },
            desc: 'Colour scheme for the table.'
        },
    ];

	rmvpp.Plugins[pluginName].reactions = [
		{
			id : 'filter',
			name : 'Filter',
			description : 'Accepts a column map and value and filters the report if the subject area matches.',
			type : 'general'
		}
	];

	rmvpp.Plugins[pluginName].specialCondFormats = [ // Special conditional format presets for this plugin
		{
			id: 'heatmap',
			name: 'Heatmap',
			noValue: true, // No comparison value is required
            description: 'Colours cells in table based on value. As such a value for the formatting rule is not required, instead the root colour should be chosen.'
		}
	];

    rmvpp.Plugins[pluginName].render = function(data, columnMap, config, container, condFormats) {
		var sortedAttrs = rmvpp.uniqueDims(data, columnMap); // Get object of unique dimension attributes, ordered as by OBIEE

		$(container).append('<div class="pivot-table"></div>');
		var pivotTable = $(container).find('.pivot-table');

		var pivotData = [];
		data.forEach(function(row) {
			var rowObj = {};
			row.columns.forEach(function(c, i) { rowObj[c.name] = columnMap.columns[i].format(c.value); });
			row.rows.forEach(function(r, i) { rowObj[r.name] = columnMap.rows[i].format(r.value); });
			row.measures.forEach(function(m, i) { rowObj[m.name] = m.value; });
			row.hidden.forEach(function(h, i) { rowObj[h.name] = h.value; });
			pivotData.push(rowObj);
		});

		var measureAggregators = {}, hideVals = [];
		columnMap.measures.forEach(function(m) {
			measureAggregators[m.Name] = m.Config.aggregator;
			if (m.Config.hide)
				hideVals.push(m.Name);
		});



		// Render pivot table
		pivotTable.pivotUI(pivotData, {
			vals: columnMap.measures.map(function(d) { return d.Name; }),
			rows: columnMap.rows.map(function(d) { return d.Name; }),
			cols: columnMap.columns.map(function(d) { return d.Name; }),
			hidden: columnMap.hidden.map(function(d) { return d.Name; }),
			valueCol: config.valuesAsCols,
			sortedAttrs : sortedAttrs,
			aggregatorName: config.defaultaggregator,
			measureAggregators: measureAggregators,
			hideVals : hideVals,
			rendererOptions: {
				columnMap: columnMap,
				colour: config.themeColour,
				rawData: data,
				condFormats: condFormats,
				width: config.width,
				height: config.height,
				columnWidth: config.columnWidth
			},
			rendererName: config.renderer
		});

		var tooltip = new rmvpp.Tooltip(container);

		var pivotContainer = $(container).find('.pivot-table');
		pivotContainer.find('.pvtAxisContainer').hide();
		pivotContainer.find('.pvtVals').hide();
		pivotContainer.find('.pvtRenderer').hide();
		pivotContainer.find('.excludeLabel').hide();
		if (config.controls) { // Add controls toolbar
			var toolbar = $('<div class="pvtToolbar"></div>');
			rmvpp.iconButton(toolbar, 'cog', 'Configuration', tooltip, '#1581F1', function() {
				pvtUI = pivotContainer.find('.pvtUi')
				if (pvtUI.find('.pvtAxisContainer').css('display') == 'none') {
					pvtUI.find('.pvtAxisContainer, .pvtVals, .pvtRenderer, .excludeLabel').show();
				} else {
					pvtUI.find('.pvtAxisContainer, .pvtVals, .pvtRenderer, .excludeLabel').hide();
				}
			})
			pivotContainer.prepend(toolbar);
		}

		if (insights.Edit) {
			// Get column from its name, regardless of whether row or column originally
			function getColFromName(name) {
				var col = columnMap.rows.filter(function(r) { return r.Name == name; });
				if (col.length > 0)
					return col[0];

				var col = columnMap.columns.filter(function(r) { return r.Name == name; });
				if (col.length > 0)
					return col[0];
			}

			// Check for refresh events from the pivot table and updates the column map
			$(container).find('div.pivot-table').on('refreshPivot', function(e, opts) {
				var rows = [], columns = [];
				opts.rows.forEach(function(row) {
					if (row != 'Values')
						rows.push(getColFromName(row));
					else
						config.valuesAsCols = false;
				});

				opts.cols.forEach(function(col) {
					if (col != 'Values')
						columns.push(getColFromName(col));
					else
						config.valuesAsCols = true;
				});

				columnMap.rows = rows;
				columnMap.columns = columns;

				// Update measure aggregator from UI
				$(container).find('.pvtVals>li').each(function() {
					var measure = $(this).find('.pvtAttr').text();
					var measureCol = columnMap.measures.filter(function(m) { return m.Name == measure;	})[0];
                    measureCol.Config.Plugin = pluginName;  // Mark column config with the plugin (necessary to tie with UI)
					measureCol.Config.aggregator = $(this).find('.pvtAggregator').val();
					measureCol.Config.hide = $(this).find('.toggleVal').hasClass('hideVal');
				});

				config.renderer = opts.rendererName;
				insights.applyChanges();
			});
		}
    }

    return rmvpp;

}(rmvpp || {}))
