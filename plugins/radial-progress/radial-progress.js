rmvpp = (function(rmvpp){

    var pluginName = "radial-progress"
    rmvpp.Plugins[pluginName] = {};
    rmvpp.Plugins[pluginName].id = pluginName;
    rmvpp.Plugins[pluginName].displayName = "Radial Progress";
    rmvpp.Plugins[pluginName].description = 'Makes a circular progress graphic, used to display ratios or percentages. Also measures can be displayed as they are, with an arbitrary maximum set or one specified by another measure column. If the value exceeds the target value a second arc is drawn inside the first one. This pattern continues up to 5 times the target value.';
    rmvpp.Plugins[pluginName].icon = "circle-o";

    rmvpp.Plugins[pluginName].columnMappingParameters = [
        {
            targetProperty : "measure",
            formLabel : "Measure",
            type: 'measure',
            required: true,
            conditionalFormat: true,
            desc: 'Aggregated measure value to display.'
        },
        {
            targetProperty : "target",
            formLabel : "Target",
            type: 'measure',
            desc: 'Target measure to use as the maximum value for comparison.'
        },
        {
            targetProperty : "hidden",
            formLabel : "Hidden",
            type: 'hidden',
            conditionalFormat: true,
            desc: 'Hidden measure to use for conditional formatting without display.'
        }
    ];

    rmvpp.Plugins[pluginName].configurationParameters = [
        {
            targetProperty:"size",
            label: "Size",
            inputType: "textbox",
            inputOptions: {
                "subType" : "number",
                "defaultValue": 200
            },
            desc: 'Size of the graphic in pixels.'
        },
        {
			targetProperty:"font",
			label: "Font",
			inputType: "font",
			inputOptions: { "defaultValue": "Open Sans"	},
            desc: 'Font to display the value in.'
		},
        {
			targetProperty:"maxValue",
			label: "Maximum Value",
			inputType: "textbox",
			inputOptions: {
                "subType" : "number",
                "defaultValue": 1
            },
            desc: 'Arbitrary maximum value to use. Is **overridden** if the *Target* column is populated.'
		},
        {
			targetProperty:"duration",
			label: "Animation Duration (ms)",
			inputType: "textbox",
			inputOptions: {
                "subType" : "number",
                "defaultValue": 1000
            },
            desc: 'Duration for the radial animation in milliseconds.'
		},
        {
			targetProperty:"roundCorners",
			label: "Rounded Corners",
			inputType: "checkbox",
			inputOptions: { "defaultValue": false	},
            desc: 'Rounds the corners of the arcs in the diagram.'
		},
        {
			targetProperty:"colours",
			label: "Colours",
			inputType: "palette",
			inputOptions: {
				"defaultValue": "Flat-UI"
			},
            desc: 'Colour palette indicating the colour for each concentric radial bar.'
		}
    ];
    rmvpp.Plugins[pluginName].actions = [];

    rmvpp.Plugins[pluginName].reactions = [
        {
            id : 'filter',
            name : 'Filter',
            description : 'Accepts a column map and value and filters the report if the subject area matches.',
            type : 'general'
        }
    ];

    rmvpp.Plugins[pluginName].render = function(data, columnMap, config, container, condFormats) {
        var width = +config.size, height = +config.size;
        var fontSize = Math.round(+config.size / 5);
        var font = config.font, duration = +config.duration;
        var colours = rmvpp.getPalette(config.colours);

        var value= data[0].measure; var minValue = 0;
        var maxValue = columnMap.target.Code ? data[0].target : +config.maxValue;
        var currentArc= 0, currentArc2= 0, currentValue=0;
        var tooltip = new rmvpp.Tooltip(container);
        var ratio = data[0].measure / maxValue;

        var arcs = [], numArcs = ratio > 5 ? 5 : Math.ceil(ratio);
        for (var i=0; i < numArcs; i++) {
            var arc = d3.svg.arc().startAngle(0 * (Math.PI/180));
            arcs.push(arc);
        }

        var arc = d3.svg.arc().startAngle(0 * (Math.PI/180));
        var arc2 = d3.svg.arc().startAngle(0 * (Math.PI/180)).endAngle(0);

        arcs.forEach(function(arc, i) {
            var scale = 1 - (0.15 * i);
            arc.outerRadius(width/2 * scale);
            arc.innerRadius(width/2 * scale - (width/2 * 0.15));
        });

        arc.outerRadius(width/2);
        arc.innerRadius(width/2 * .85);
        arc2.outerRadius(width/2 * .85);
        arc2.innerRadius(width/2 * .85 - (width/2 * .15));

        if (config.roundCorners) {
            arcs.forEach(function(arc, i) {
                arc.cornerRadius(width/2);
            });
        }

        condFormats.forEach(function(cf) {
            if (cf.compare(data[0])) {
                colours.forEach(function(colour, i) {
                    colours[i] = cf.Style.colour;
                });
            }
        });

        var selection = d3.select(container);
        var svg = selection.selectAll("svg").data(data);
        var enter = svg.enter().append("svg").attr("class","radial-svg").append("g");
        svg.attr("width", width).attr("height", height);

        // Add background arc
        var background = enter.append("g").classed("component", true);
        arcs[0].endAngle(360 * (Math.PI/180));
        background.append("path")
            .attr("transform", "translate(" + width/2 + "," + width/2 + ")")
            .attr("d", arcs[0])
            .attr('fill', '#CCCCCC');

        // Add value arc
        arcs[0].endAngle(ratio * 360 * (Math.PI/180));
            enter.append("g").attr("class", "arcs");

        var paths = [];
        arcs.forEach(function(arc, i){
            var path = svg.select(".arcs").selectAll(".arc").data(data);
            path.enter().append("path")
                .attr("class","arc" + i)
                .attr("transform", "translate(" + width/2 + "," + width/2 + ")")
                .attr('fill', colours[i])
                .on('mouseover', function(d) {
                    tooltip.displayFull(['measure', 'target'], columnMap, data[0], d3.event);
                })
                .on('mouseout', function(d) {
                    tooltip.hide();
                });
            paths.push(path);
        });

        // Add label in the center
        enter.append("g").attr("class", "labels");
        var label = svg.select(".labels").selectAll(".label").data(data);
        label.enter().append("text")
            .attr("class","label")
            .attr("y", width/2 + fontSize/3)
            .attr("x",function(d) {
                return width/2;
            })
            .attr("width", width)
            .on('mouseover', function(d) {
                tooltip.displayFull(['measure', 'target'], columnMap, data[0], d3.event);
            })
            .on('mouseout', function(d) {
                tooltip.hide();
            })
            .text(function (d) { return formatVal(+data[0].measure) })
            .style("font-size", fontSize + "px")
            .style('font-family', font);

        arcs.forEach(function(arc, i) {
            paths[i].datum(Math.min(360*(ratio-i), 360)* Math.PI/180);
            paths[i].transition().delay(duration*i).duration(duration)
                .attrTween("d", function(d) {
                    return arcTween(d, arcs[i]);
                });
        });

        // Animation function for the first arc
        function arcTween(a, arc) {
            var i = d3.interpolate(0, a);
            return function(t) {
                return arc.endAngle(i(t))();
            };
        };

        // Animate label
        label.datum(ratio);
        label.transition().duration(duration * numArcs)
            .tween("text", labelTween);

        // Animation function for the label
        function labelTween() {
            var i = d3.interpolate(currentValue, data[0].measure);
            currentValue = i(0);
            return function(t) {
                d3.select(this).attr('x', function(d) {
                    var textWidth = d3.select(this).node().getBBox().width;
                    return width/2 - (textWidth/2);
                });
                currentValue = i(t);
                this.textContent = formatVal(i(t));
            }
        }

        function formatVal(val) {
            return columnMap.measure.format(val);
        }

    };

    return rmvpp;

}(rmvpp || {}))
