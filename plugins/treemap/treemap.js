 rmvpp = (function(rmvpp){
    var pluginName = "treemap"
    rmvpp.Plugins[pluginName] = {};
    rmvpp.Plugins[pluginName].id = pluginName;
    rmvpp.Plugins[pluginName].displayName = 'Treemap';
    rmvpp.Plugins[pluginName].description = ''
    rmvpp.Plugins[pluginName].icon = "th";

    rmvpp.Plugins[pluginName].columnMappingParameters = [
        {
			targetProperty:"group",
			formLabel:"Group By",
			type: 'dim',
			required: true,
            conditionalFormat: true,
            desc: 'Group by this column to provide tiles on the tree map.'
		},
        {
			targetProperty:"measure",
			formLabel:"Measure",
			type: 'fact',
			required: true,
            desc: 'Aggregatable fact column with which to size and colour the tree map. '
		},
        {
			targetProperty:"vary",
			formLabel:"Vary By Colour",
			type: 'dim',
            desc: 'Attribute to further divide the treemap, also colouring different sections.'
		}
    ];

    rmvpp.Plugins[pluginName].configurationParameters = [
        {
			targetProperty:"width",
			label: "Width",
			inputType: "textbox",
			inputOptions: {
				subtype : "number",
				defaultValue : 500
			},
            desc: 'Width of the chart in pixels.'
		},
		{
			targetProperty:"height",
			label: "Height",
			inputType: "textbox",
			inputOptions: {
				subtype : "number",
				defaultValue : 400
			},
            desc: 'Height of the chart in pixels.'
		},
        {
			targetProperty:"roundCorners",
			label: "Round Corners",
			inputType: "checkbox",
			inputOptions: {	defaultValue : true	},
            desc: 'Rounds the corners of each tile in the treemap.'
		},
        {
            targetProperty:"fontSize",
			label: "Font size",
			inputType: "textbox",
			inputOptions: {
                subtype : "number",
				defaultValue : 12,
                min: 6,
                max: 72
            },
            desc: 'Font size in pixels in which to display the text for each cell.'
        },
        {
			targetProperty:"colours",
			label: "Colours",
			inputType: "palette",
			inputOptions: { "defaultValue": "Flat-UI"	},
            desc: 'Colour palette to use for discrete series colours.'
		}
    ];

    rmvpp.Plugins[pluginName].actions = [
        {
			'trigger' : 'tileHover',
			'type' : 'mouseover',
			'name' : 'Hover - Tile',
			'output' : ['group', 'vary'],
			'description' : 'Hover over a tile to pass across the values.'
		},
        {
			'trigger' : 'tileClick',
			'type' : 'click',
			'name' : 'Click - Tile',
			'output' : ['group', 'vary'],
			'description' : 'Click on a tile to pass across the values.'
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

    rmvpp.Plugins[pluginName].render = function(data, columnMap, config, container, condFormats)   {
        var width = +config.width, height = +config.height;
        var colours = rmvpp.getPalette(config.colours);
        var tooltip = new rmvpp.Tooltip(container);
        var borderRadius = config.roundCorners ? '5px' : '0px';

        var min = d3.min(data.map(function(d) { return +d.measure; }));
        var max = d3.max(data.map(function(d) { return +d.measure; }));

        // Unique values to vary by colour
        var uniqueVary = d3.set(data.map(function(d) { return d.vary; })).values();
        var gradients = [];

        uniqueVary.forEach(function(v, i) {
            var loopRef = (i - (Math.floor(i/(colours.length)) * colours.length));
            var gradColour = rmvpp.gradientColour(colours[loopRef], min, max);
            gradients.push(gradColour);
        });

        var colourScale = d3.scale.ordinal()
            .range(gradients)
            .domain(d3.set(uniqueVary).values());

        var gradColour = rmvpp.gradientColour(colours[0], min, max);

        // D3 treemap likes to have object hierarchies with `name` and `children` properties
        var hierarchy = {};
        if (columnMap.vary.Code) { // Nest data for the correct structure when varying by colour
            hierarchy.name = columnMap.vary.Name;
            var nest = d3.nest().key(function(d) { return d.vary }).entries(data);
            nest.forEach(function(n) {
                n.children = n.values;
            });
            hierarchy.children = nest;
        } else {
            hierarchy.name = columnMap.group.Name;
            hierarchy.children = data;
        }

        var treemap = d3.layout.treemap()
            .size([width, height])
            .sticky(true)
            .value(function(d) { return +d.measure; });

        var subContainer = d3.select(container).append("div")

        var div = subContainer.append("div")
            .style("position", "relative")
            .style('display', 'inline-block')
            .style("width", (width + "px"))
            .style("height", (height + "px"));

        var node = div.datum(hierarchy).selectAll(".node")
            .data(treemap.nodes)
                .enter().append("div")
            .attr("class", "node")
            .style({
                'text-align' : 'center',
                'position' : 'absolute',
                'overflow' : 'hidden',
                'border': 'solid 1px white'
            })
            .style("left", function(d) { return d.x + "px"; })
            .style("top", function(d) { return d.y + "px"; })
            .style("width", function(d) { return Math.max(0, d.dx - 1) + "px"; })
            .style("height", function(d) { return Math.max(0, d.dy - 1) + "px"; })
            .style("border-radius", borderRadius)
            .style('color', function(d) {
                if (d.measure) {
                    b = rmvpp.getBrightness(colourScale(d.vary)(+d.measure));
                    return b > 0.6 ? 'black' : 'white';
                }
            })
            .style("background", function(d) {
                var bg = colourScale(d.vary)(+d.measure);
                condFormats.forEach(function(cf) {
                    if (cf.compare(d))
                        bg = cf.Style.colour;
                })
                return bg;
            })
            .on('mouseover', function(d) {
                tooltip.displayFull(['vary', 'group', 'measure'], columnMap, d, d3.event);
                rmvpp.createTrigger(pluginName, columnMap, container, 'tileHover', d); // Trigger hoverTile event
            })
            .on('click', function(d) {
                rmvpp.createTrigger(pluginName, columnMap, container, 'tileClick', d); // Trigger hoverTile event
            })
            .on('mouseout', function(d) {
                tooltip.hide();
            })

        node.append('div')
            .style('cursor', 'default')
            .style('font-size', config.fontSize + 'px')
            .style('margin-top', function(d) {
                return Math.round((d.dy-17)/2) + 'px';
            })
            .text(function(d) { return d.group; });

        // Add an HTML legend when varying by colour
        if (columnMap.vary.Code) {
            var legend = subContainer.append('div')
                .classed('legend', true)
                .classed('do-not-print', true)
                .style('display', 'inline-block')
                .style('vertical-align', 'top')
                .style('margin-left', '10px');

            legend.append('div').text(columnMap.vary.Name).style({
                'font-size' : '10px',
                'font-family' : 'monospace',
                'text-align' : 'center'
            });
            uniqueVary.forEach(function(v, i) {
                var loopRef = (i - (Math.floor(i/(colours.length)) * colours.length));
                var row = legend.append('div').style({
                    'vertical-align': 'middle',
                    'text-align': 'right',
                });
                row.append('span').style({
                    'display' : 'inline-block',
                    'font-size' : '10px',
                    'font-family' : 'monospace',
                    'margin-right' : '5px'
                }).text(v);
                row.append('span').style({
                    'width': '18px',
                    'height': '18px',
                    'background' : colours[loopRef],
                    'display' : 'inline-block'
                });
            });
        }
    }

    return rmvpp;

 }(rmvpp || {}))
