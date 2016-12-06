 rmvpp = (function(rmvpp){

    var pluginName = "pie"
    rmvpp.Plugins[pluginName] = {};
    rmvpp.Plugins[pluginName].id = pluginName;
    rmvpp.Plugins[pluginName].displayName = "Pie Chart";
    rmvpp.Plugins[pluginName].description = 'Pie or donut chart visualisation used to display discrete information. Can hover over slices for tooltip information.';
	rmvpp.Plugins[pluginName].icon = "pie-chart";

    rmvpp.Plugins[pluginName].columnMappingParameters = [
        {
            targetProperty:"category",
            formLabel:"Category",
			type: 'dim',
			required: true,
            conditionalFormat: true,
            desc: 'Attribute with which to group the slices.'
        },
        {
            targetProperty:"measure",
            formLabel:"Measure",
			type: 'fact',
			required: true,
            desc: 'Measure affecting hte size of each slice.'
        }
    ]

    rmvpp.Plugins[pluginName].configurationParameters = [
        {
            targetProperty:"size",
            label: "Size",
            inputType: "textbox",
            inputOptions: {
                "subType" : "number",
                "defaultValue": 400
            },
            desc: 'Size of the pie chart in pixels.'
        },
        {
            targetProperty:"innerRadius",
            label: "Inner Radius",
            inputType: "textbox",
            inputOptions: {
                "defaultValue": 0
            },
            scalable: 'size',
            desc: 'Inner radius in pixels, turning the chart into a donut chart.'
        },
        {
			targetProperty:"legend",
			label: "Show Legend",
			inputType: "checkbox",
			inputOptions: { defaultValue : true	},
            desc: 'Boolean which if true, will show the legend.'
		},
        {
			targetProperty:"colours",
			label: "Colours",
			inputType: "palette",
			inputOptions: {
				"defaultValue": "Flat-UI"
			},
            desc: 'Colour palette to use for discrete series colours.'
		}
    ]

	rmvpp.Plugins[pluginName].actions = [
		{
			'trigger' : 'clickSlice',
			'type' : 'click',
			'name' : 'Click Slice',
			'output' : ['category'],
			'description' : 'Click a slice to pass the data.'
		},
		{
			'trigger' : 'hoverSlice',
			'type' : 'hover',
			'name' : 'Hover Slice',
			'output' : ['category'],
			'description' : 'Hover over a slice to pass the data.'
		}
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
		// Set colour scale
		var colourNames = data.map(function(d) { return d.category; });
		var colour = rmvpp.colourScale(colourNames, config.colours);

		// Set width, height, radii
		var width = +config.size, height = +config.size;
		var radius = +config.size / 2;

		// Zero size for animation
		var zeroArc = d3.svg.arc()
			.outerRadius(1)
			.innerRadius(config.innerRadius);

		// Create arc (inner/outer radius)
		var arc = d3.svg.arc()
			.outerRadius(radius - 10)
			.innerRadius(config.innerRadius);

		// Create full, invisible, arc for mouse events
		var fullArc = d3.svg.arc()
			.outerRadius(radius - 10)
			.innerRadius(0);

		// Tie pie layout to the measure attribute
		var pie = d3.layout.pie()
			.sort(null)
			.value(function(d) { return +d.measure; });

		var chartContainer = d3.select(container)
			.append('div')
			.classed('pie-chart', true);

		// Create tooltip
		var selector = $(chartContainer[0]).toArray();
		var tooltip = new rmvpp.Tooltip(chartContainer[0][0]);

		// Render chart SVG
		var chart = chartContainer.append("svg")
			.attr("width", width)
			.attr("height", height)
			.append("g")
				.attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

		// Create legend
        if (config.legend) {
            var legend = new rmvpp.Legend(chart, colourNames, columnMap.category.Name, radius);
    		legend.addColourKey(colourNames, colour);
            legend.repositionCircular();
        }

		var g = chart.selectAll(".arc")
			.data(pie(data.filter(function(d) { return +d.measure != 0; })))
			.enter().append("g")
				.attr("class", "arc");

        function getColour(datum) {
            var bg = colour(datum.category);
            condFormats.forEach(function(cf) {
                if (cf.compare(datum))
                    bg = cf.Style.colour;
            });
            return bg;
        }

		var path = g.append("path")
			.attr("d", zeroArc)
			.classed('main', true)
			.style("fill", function(d) {
                return getColour(d.data);
            })
			.style("stroke", function(d) {
                return rmvpp.reduceBrightness(getColour(d.data), 25);
            })
			.transition()
				.duration(500)
				.attr('d', arc)
				.attr('pointer-events', '') // Enable pointer events until animation complete

		var invisPath = g.append('path')
			.attr('d', fullArc)
			.classed('invisible', true)
			.style('opacity', '0')
			.attr('pointer-events', 'none') // Disable pointer events until animation complete
			.on('mouseover', function(d, i) {
				d3.select(this.previousSibling)
					.transition()
					.style('fill', function(d) { return rmvpp.increaseBrightness(getColour(d.data), 25); })
					.attr('transform', function(d, i) {
						var offset = 10;
						var angle = (d.startAngle + d.endAngle) / 2;
						var xOff = Math.sin(angle)*offset;
						var yOff = -Math.cos(angle)*offset;
						return "translate("+xOff+","+yOff+")";
					});
				tooltip.displayFull(['category', 'measure'], columnMap, d.data, d3.event);
				rmvpp.createTrigger(pluginName, columnMap, container, 'hoverSlice', d.data); // Trigger event
			})
			.on('mouseout', function(d, i) {
				d3.select(this.previousSibling)
					.transition()
					.style('fill', function(d) { return getColour(d.data); })
					.attr('transform', 'translate(0,0)')
				tooltip.hide();
			})
			.on('click', function(d, i) {
				rmvpp.createTrigger(pluginName, columnMap, container, 'clickSlice', d.data); // Trigger event
			})
			.transition().duration(500)
			.transition().attr('pointer-events', ''); //Enable pointer events until animation complete

	}
    return rmvpp;

}(rmvpp || {}))
