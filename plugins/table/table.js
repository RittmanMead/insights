 rmvpp = (function(rmvpp){

    var pluginName = "table"
    rmvpp.Plugins[pluginName] = {};
    rmvpp.Plugins[pluginName].id = pluginName;
    rmvpp.Plugins[pluginName].displayName = "Table";
    rmvpp.Plugins[pluginName].description = 'Basic table visualisation, created using the [AG Grid](https://www.ag-grid.com/) plugin to create a scrollable table of results. Features include sorting by column and searching by text. Neither of these require going back to the database. Users can also change the order and width of columns as well as freezing the panes by pinning certain columns to the left or right.';
	rmvpp.Plugins[pluginName].icon = "table";

    rmvpp.Plugins[pluginName].columnMappingParameters = [
		{
			targetProperty:"columns",
			formLabel:"Column",
			multiple: true,
			type: 'any',
			required: true,
			conditionalFormat: true,
            desc: 'Choose multiple columns to add to the table. Will display left to right in the order selected here.',
			config: [
				{
					targetProperty:"width",
					label: "Column Width",
					inputType: "textbox",
					inputOptions: {
						subtype : 'number',
                        defaultValue: -1
					},
                    desc: 'Width of the column in pixels. Set to -1 for auto sizing.'
				},
				{
					targetProperty:"pinned",
					label: "Pinned",
					inputType: "radio",
					inputOptions: {
						"values":["None", "Left", "Right"] ,
						"defaultValue": "None"
					},
                    desc: 'Choose to pin the column to the left or right of the table so it is always visible when scrolling.'
				}
			]
		},
		{
			targetProperty:"hidden",
			formLabel:"Hidden",
			multiple: true,
			type: 'hidden',
            desc: 'Can use hidden columns that will not display in the table but will affect the data set. Can be used to conditionally format data based on undisplayed information.'
		}
	];

    rmvpp.Plugins[pluginName].configurationParameters = [
        {
            targetProperty:"width",
            label: "Width",
            inputType: "textbox",
            inputOptions: {
                subtype : 'number',
                defaultValue : 400,
                min: 0
            },
            desc: 'Width of the table in pixels.'
        },
		{
            targetProperty:"height",
            label: "Height",
            inputType: "textbox",
            inputOptions: {
                subtype : 'number',
                defaultValue : 400,
                min: 0
            },
            desc: 'Height of the table in pixels.'
        },
		{
            targetProperty:"themeColour",
            label: "Theme Colour",
            inputType: "colour",
            inputOptions: { "defaultValue": "#5DA5DA" },
            desc: 'Sets the colour for the table. Will have a solid line below the header and a lighter shade of the colour for a hover over of each row.'
        },
		{
			targetProperty:"font",
			label: "Font",
			inputType: "font",
			inputOptions: { "defaultValue": "Open Sans"	},
            desc: 'String input for the font to display the table in.'
		},
		{
            targetProperty:"fontSize",
            label: "Font Size",
            inputType: "textbox",
            inputOptions: {
                subtype : 'number',
				"min" : 8,
				"max" : 72,
                defaultValue : 11
            },
            desc: 'Size of the font to display in the table.'
        },
        {
			targetProperty:"wrapHeader",
			label: "Wrap Headers",
			inputType: "checkbox",
			inputOptions: { "defaultValue": false },
            desc: 'Wraps header text and automatically makes header taller to compensate.'
		},
    ];

	rmvpp.Plugins[pluginName].actions = [
		{
			'trigger' : 'rowClick',
			'type' : 'click',
			'output' : ['columns'],
			'name' : 'Click - Row',
			'description' : 'Click on a row to pass values of chosen columns.'
		},
		{
			'trigger' : 'rowHover',
			'type' : 'mouseover',
			'output' : ['columns'],
			'name' : 'Hover - Row',
			'description' : 'Hover over a row to pass values of chosen columns.'
		}
	];

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
			type : 'private'
		}
	];

	// Custom action handler to search table. Accepts output (expecting value property) and container
	rmvpp.Plugins[pluginName].search = function(output, container) {
        function filterNulls(val) { return val; }
		var searchVal = output.map(function(d) {
            return d.values.filter(filterNulls).join(' ');
        }).filter(filterNulls).join(' ');
        $(container).find('input.search').val(searchVal).trigger('keydown');
	}

    rmvpp.Plugins[pluginName].render = function(data, columnMap, config, container, condFormats)   {
		var columnDefs = []; // Declare columns
		columnMap.columns.forEach(function(c, i) {
			var isNum = $.inArray(c.DataType, ['integer', 'double']) > - 1;

			// Custom sorting functions - dynamically created so as specific to each column
			var comparator = function(val1, val2) { return d3.ascending(val1,val2); } // Text ordering
			var filter = 'text';
			if (c.SortKey) { // Sort key ordering
				comparator = function(val1, val2, row1, row2) {
					var sortCol = c.Name + ' (Sort)';
					return d3.ascending(+row1.data[sortCol], +row2.data[sortCol]);
				}
			} else if ($.inArray(c.DataType, ['integer', 'double']) > - 1) { // Numeric ordering
				comparator = function(val1, val2) { return d3.ascending(+val1, +val2); };
				filter = 'number';
			}

			var cellRenderer = function(params) {
				var filterCF = condFormats.filter(function(cf) { return cf.TargetID == 'columns'; });
				filterCF = filterCF.concat(
                    condFormats.filter(function(cf) {
                        return cf.TargetID == 'columns' + (i);
                    })
                );
				filterCF.forEach(function(cf) {
					if (cf.compare(params.data)) {
						$(params.eGridCell).css({
							'color' : cf.Style.colour,
							'font-weight' : 'bold'
						});
					}
				});
				return c.format(params.value);
			}

			var colWidth = c.Config.width == -1 || !c.Config ? 100 : +c.Config.width;
			var pinned = c.Config.pinned ? c.Config.pinned.toLowerCase() : 'None';

			columnDefs.push({
				headerName : c.Name,
				field : c.Name,
				comparator : comparator,
				cellRenderer : cellRenderer,
				filter: filter,
				width: colWidth,
				pinned: pinned
			});
		});

        var gridOptions = {
            columnDefs: columnDefs,
            rowData: data,
            enableSorting: true,
            enableColResize: true,
            enableFilter: true,
            headerHeight: 25
        };

        function getColFromID(colId) {
            return columnMap.columns.filter(function(c) {
                return c.Name == colId;
            })[0]
        }

        var tooltip = new rmvpp.Tooltip(container);

        $(container).append('<div class="rm-table-toolbar do-not-print"></div>');
        var toolbar = $(container).find('.rm-table-toolbar');

        // Autosize button
        rmvpp.iconButton(toolbar, 'magic', 'Autosize', tooltip, '#FFA500', autoSizeAll);
        rmvpp.iconButton(toolbar, 'arrows-h', 'Size to Fit', tooltip, '#FFA500', sizeToFit);

        $(container).find('.rm-table-toolbar i').css('margin-right', '5px');

        // Quick filter
        function onFilterChanged(value) {
            gridOptions.api.setQuickFilter(value);
        }

        $(toolbar).append($('<input class="search" placeholder="Filter..." type="text"/>')
            .on('keydown', function() {
                var searchInp = $(container).find('input.search')
                setTimeout(function() {
                    onFilterChanged(searchInp.val());
                }, 1);
            })
        );

        var clean = true;
        function renderTable(gridOptions) {
            var height = +config.height;

            $(container).find('.rm-table').remove();
    		$(container).append( '<div class="rm-table ag-rm print-as-html" style="height: ' + height + 'px; width: ' + config.width + 'px;"></div>' );
    		new agGrid.Grid($(container).find('.rm-table')[0], gridOptions);

    		// Interaction handlers
    		gridOptions.api.addEventListener('rowClicked', function(e) {
    			rmvpp.createTrigger(pluginName, columnMap, container, 'rowClick', e.data);
    		});

    		// Added custom rowHovered event to the AG Grid library
    		gridOptions.api.addEventListener('rowMouseover', function(e) {
    			$(e.eventSource.eBodyRow).css('background-color', rmvpp.setBrightness(config.themeColour, 96));
    			rmvpp.createTrigger(pluginName, columnMap, container, 'rowHover', e.data);
    		});

    		// Mouseout handler
    		gridOptions.api.addEventListener('rowMouseout', function(e) {
    			$(e.eventSource.eBodyRow).css('background-color', '');
    			rmvpp.createTrigger(pluginName, columnMap, container, 'rowHover', e.data);
    		});

            gridOptions.api.addEventListener('columnResized', function(e) {
                wrapHeader();
                hideBorder();
            });

            // Function which checks all headers to see if wrapping needs to be done adn does so if necessary
            function wrapHeader() {
                if (config.wrapHeader) {
                    var headers = $(container).find('.ag-header-cell');
                    var increaseHeader = false, scales = [];

                    for (i=0; i < headers.length; i++) {
                        label = $(headers[i]).find('.ag-header-cell-text');
                        var origHeight = label.height();
                        label.css('white-space', 'nowrap');
                        scales.push(Math.round(origHeight / label.height()));
                        label.css('white-space', 'normal');
                    }

                    var maxScale = d3.max(scales);
                    var newHeight = (maxScale * 17)+8;
                    if (gridOptions.headerHeight != newHeight) {
                        gridOptions.headerHeight = newHeight;
                        $(container).find('.ag-body').css('padding-top', gridOptions.headerHeight + 'px');
                        $(container).find('.ag-header, .ag-header-row').css('height', gridOptions.headerHeight + 'px');
                    }
                }
            }

    		// Column resize handler for updating column map
    		if (insights.Edit) { // Only execute in build mode, not view mode
    			gridOptions.api.addEventListener('columnResized', function(e) {
    				if (e.column) {
    					var col = getColFromID(e.column.colId);
    					col.Config.Plugin = pluginName; // Mark column config with the plugin (necessary to tie with UI)
    					col.Config.width = e.column.actualWidth;
                        insights.applyChanges();
    				}
    			});

    			gridOptions.api.addEventListener('columnMoved', function(e) {
    				var col = getColFromID(e.column.colId);
    				var oldIndex = $.inArray(col, columnMap.columns);
    				$.moveInArray(columnMap.columns, oldIndex, e.toIndex);
    				col.Config.Plugin = pluginName; // Mark column config with the plugin (necessary to tie with UI)
    				col.Config.pinned = 'None';
                    wrapHeader();
    				insights.applyChanges();
    			});

    			gridOptions.api.addEventListener('columnPinned', function(e) {
    				var col = getColFromID(e.column.colId);
    				col.Config.Plugin = pluginName; // Mark column config with the plugin (necessary to tie with UI)
    				col.Config.pinned = e.pinned ? e.pinned.toProperCase() : 'None';
                    wrapHeader();
                    insights.applyChanges();
    			});
    		}

    		// Apply configuration styling
    		var brightness = rmvpp.getBrightness(config.themeColour);
    		var contrast = brightness > 0.7 ? 'black' : 'white';
    		$(container).find('.ag-header').css({
    			'background' : config.themeColour,
    			'border-bottom': '1px solid ' + config.themeColour,
    			'color': contrast
    		});
    		$(container).find('.ag-root').css({
    			'font-family' : config.font,
    			'font-size' : config.fontSize + 'px'
    		});
    		$(container).find('.ag-header-cell').css('border-color', contrast);

            if (config.wrapHeader) {
                $(container).find('.ag-header-cell-text').css('white-space', 'normal');
                wrapHeader();
            }

            hideBorder();
        }

        // Hide border if there is no scrollbar to show
        function hideBorder() {
            var viewport = $(container).find('.ag-body-viewport');
            if (!viewport.hasVertScrollBar() && !viewport.hasHorizScrollBar()) {
                $(container).find('.ag-rm .ag-root').css('border', '0px');
                $(container).find('.ag-rm .ag-row').css('border-left', '1px solid #CCC');
                var rowWidth = $(container).find('.ag-rm .ag-body-viewport .ag-row').first().width();
                $(container).find('.ag-rm .ag-header').css('width', rowWidth + 'px');
                $(container).find('.ag-rm .ag-header-cell').css('margin-left', '1px');
                $(container).find('.ag-rm .ag-root').css('border-radius', '');
            } else {
                $(container).find('.ag-root').css('border', '1px solid ' + config.themeColour);
                $(container).find('.ag-rm .ag-row').css('border-left', '0px');
                $(container).find('.ag-rm .ag-header').css('width', '');
                $(container).find('.ag-rm .ag-header-cell').css('margin-left', '');
                $(container).find('.ag-rm .ag-root').css('border-radius', '5px 5px 0px 0px');
            }
        }


        function autoSizeAll() {
            columnMap.columns[0].Config.width = 150;
            var colIds = columnDefs.map(function(col) { return col.field; });
            gridOptions.columnApi.autoSizeColumns(colIds);
            if (insights.Edit) {
                $(container).find('.ag-header-cell').each(function() {
                    var col = getColFromID($(this).attr('colid'));
                    col.Config.width = $(this).width();
                });
                insights.applyChanges();
            }
        }

        function sizeToFit() {
            var colIds = columnDefs.map(function(col) { return col.field; });
            gridOptions.api.sizeColumnsToFit(colIds);
            if (insights.Edit) {
                $(container).find('.ag-header-cell').each(function() {
                    var col = getColFromID($(this).attr('colid'));
                    col.Config.width = $(this).width();
                });
                insights.applyChanges();
            }
        }

        function refresh() {
            renderTable(gridOptions);
        }

        renderTable(gridOptions);
    }

    return rmvpp;

}(rmvpp || {}))
