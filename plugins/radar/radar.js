 rmvpp = (function(rmvpp){
    var pluginName = "radar"
    rmvpp.Plugins[pluginName] = {};
    rmvpp.Plugins[pluginName].id = pluginName;
    rmvpp.Plugins[pluginName].displayName = 'Radar';
    rmvpp.Plugins[pluginName].description = 'Radar (or Spider) charts which show multivariate, discrete data series. The relative position and angle of the axes is uninformative.';
    rmvpp.Plugins[pluginName].icon = "compass";

    rmvpp.Plugins[pluginName].columnMappingParameters = [
        {
			targetProperty:"category",
			formLabel:"Category",
			type: 'dim',
            multiple: false,
			required: true,
            desc: 'Discrete values to place around the radar.'
		},
        {
			targetProperty:"measure",
			formLabel:"Measure",
			type: 'fact',
            multiple: true,
			required: true,
            desc: 'Numeric values to plot in series around the radar chart'
		},
    ];

    rmvpp.Plugins[pluginName].configurationParameters = [
        {
			targetProperty:"size",
			label: "Size",
			inputType: "textbox",
			inputOptions: {
				subtype : "number",
				defaultValue : 400
			},
            desc: 'Size of the chart in pixels.'
		},
        {
			targetProperty:"levels",
			label: "Levels",
			inputType: "textbox",
			inputOptions: {
				subtype : "number",
				defaultValue : 5
			},
            desc: 'Number of concentric rings in the radar chart.'
		},
        {
			targetProperty:"pointSize",
			label: "Point Size",
			inputType: "textbox",
			inputOptions: {
				subtype : "number",
				defaultValue : 4
			},
            desc: 'Size of the points on the radar chart.'
		},
        {
			targetProperty:"fillOpacity",
			label: "Fill Opacity",
			inputType: "textbox",
			inputOptions: {
				subtype : "number",
				defaultValue : 0.15
			},
            desc: 'Fill opacity for the areas covered by the chart polygons.'
		},
        {
			targetProperty:"strokeOpacity",
			label: "Outline Opacity",
			inputType: "textbox",
			inputOptions: {
				subtype : "number",
				defaultValue : 1
			},
            desc: 'Opacity for the outline of the polygons.'
		},
        {
			targetProperty:"ownScale",
			label: " Individual Scales",
			inputType: "checkbox",
			inputOptions: {
				defaultValue : false
			},
            desc: 'When set, this option causes each data series to use its own scale, so larger numbers can be directly compared with smaller numbers.'
		},
        {
			targetProperty:"legend",
			label: "Legend",
			inputType: "checkbox",
			inputOptions: {
				defaultValue : true
			},
            desc: 'Legend displaying the key for the measures in the series.'
		},
        {
			targetProperty:"colours",
			label: "Colours",
			inputType: "palette",
			inputOptions: { "defaultValue": "Flat-UI"	},
            desc: 'Colour palette to use for discrete series colours'
		}
    ];

    rmvpp.Plugins[pluginName].actions = [

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
        var chartContainer = d3.select(container)
			.append('div')
			.classed('radar-chart', true);

        var maxY = [];
        columnMap.measure.forEach(function(m, i) {
            if (config.ownScale) {
                maxY.push(d3.max(data.map(function(d) { return +d.measure[i].value; })));
            } else {
                maxY.push(d3.max(data, function(d) { return d3.max(d.measure, function(d) { return +d.value; }); }));
            }
        });

        // var maxY = d3.max(data, function(d) { return d3.max(d.measure, function(d) { return +d.value; }); });
        var width = +config.size, height = +config.size, radius = +config.size / 2, levels = +config.levels;
        var radians = 2 * Math.PI;

        var colour = rmvpp.colourScale(data[0].measure.map(function(d) { return d.name; }), config.colours); // Set colour scale
        var allCat = data.map(function(d) { return d.category; });
        var strLength = rmvpp.longestString(allCat), colNames = columnMap.measure.map(function(d) { return d.Name; });

        var tooltip = new rmvpp.Tooltip(container); // Create tooltip object

        var margin = {
            top: 30,
            left: strLength,
            right: strLength,
            bottom: 0
        }

        // Create chart area
        var g = chartContainer
			.append("svg")
			.attr("width", width + (margin.left + margin.right))
			.attr("height", height + 60)
			.append("g")
			.attr("transform", "translate(" + margin.left + ", " + margin.top + ")");

        if (config.legend) {
            var legend = new rmvpp.Legend(g, colNames, 'Measures', width + (strLength / 2), margin);
            legend.addColourKey(colNames, colour); // Legend Colour Key
            legend.Element.selectAll('.key')
                .on('mouseover', function(d, i) {
                    var seriesClass = 'radar-chart-series-' + i;
                    d3.select(container).selectAll('polygon').transition(200)
                        .style('fill-opacity', function() {
                            return d3.select(this).classed(seriesClass) ? 0.5 : 0;
                        })
                        .style('stroke-opacity', function() {
                            return d3.select(this).classed(seriesClass) ? 1 : 0;
                        });

                    d3.select(container).selectAll('circle').transition(200).style('opacity', function() {
                        return d3.select(this).classed(seriesClass) ? 1 : 0;
                    })
                })
                .on('mouseout', function(d, i) {
                    d3.select(container).selectAll('polygon').transition(200)
                        .style('fill-opacity', +config.fillOpacity)
                        .style('stroke-opacity', +config.strokeOpacity);
                    d3.select(container).selectAll('circle').transition(200).style('fill-opacity', 1);
                })
        }

        // Plot concentric circles in accordance to configured levels
        for(var j = 0; j < levels - 1; j++){
            var levelFactor = radius*((j+1)/levels);
            g.selectAll(".levels")
                .data(allCat)
                .enter()
                .append("svg:line")
                .attr("x1", function(d, i){return levelFactor*(1-Math.sin(i*radians/allCat.length));})
                .attr("y1", function(d, i){return levelFactor*(1-Math.cos(i*radians/allCat.length));})
                .attr("x2", function(d, i){return levelFactor*(1-Math.sin((i+1)*radians/allCat.length));})
                .attr("y2", function(d, i){return levelFactor*(1-Math.cos((i+1)*radians/allCat.length));})
                .attr("class", "line")
                .style("stroke", "#CCCCCC")
                .style("stroke-opacity", "1")
                .style("stroke-width", "1px")
                .attr("transform", "translate(" + (width/2-levelFactor) + ", " + (height/2-levelFactor) + ")");
        }

        // Plot axis lines
    	var axis = g.selectAll(".axis")
            .data(allCat)
            .enter()
			.append("g")
			.attr("class", "axis");

        // Axis lines
    	axis.append("line")
    		.attr("x1", width / 2)
    		.attr("y1", height /2)
    		.attr("x2", function(d, i){return width/2*(1-Math.sin(i*radians/allCat.length));})
    		.attr("y2", function(d, i){return height/2*(1-Math.cos(i*radians/allCat.length));})
    		.attr("class", "line")
    		.style("stroke", "#666666")
    		.style("stroke-width", "1px");

        // Axis labels
        axis.append("text")
    		.attr("class", "legend")
    		.text(function(d){ return d; })
    		.style("font-family", "monospace")
    		.style("font-size", "11px")
    		.attr("text-anchor", "middle")
    		.attr("dy", "1.5em")
    		.attr("transform", function(d, i){return "translate(0, -10)"})
    		.attr("x", function(d, i){return width/2*(1-Math.sin(i*radians/allCat.length))-60*Math.sin(i*radians/allCat.length);})
    		.attr("y", function(d, i){return height/2*(1-Math.cos(i*radians/allCat.length))-20*Math.cos(i*radians/allCat.length);});

        columnMap.measure.forEach(function(y, series){
            dataValues = [];
            g.selectAll(".nodes")
    	       .data(data, function(j, i){
                   dataValues.push([
                       width/2*(1-(parseFloat(Math.max(j.measure[series].value, 0)) / maxY[series])*Math.sin(i * radians/ allCat.length)),
                       height/2*(1-(parseFloat(Math.max(j.measure[series].value, 0)) / maxY[series])*Math.cos(i * radians/ allCat.length))
                   ]);
               });
                dataValues.push(dataValues[0]);
                g.selectAll(".area")
            .data([dataValues])
            .enter()
            .append("polygon")
            .attr("class", "radar-chart-series-"+series)
            .style("stroke-width", "2px")
            .style("stroke", colour(y.Name))
            .style('stroke-opacity', +config.strokeOpacity)
            .attr("points",function(d) {
                var str = "";
                for(var pti=0; pti < d.length; pti++){
                   	str = str + d[pti][0] + "," + d[pti][1] + " ";
                }
                    return str;
               })
            .style("fill", function(){ return colour(y.Name) })
            .style("fill-opacity", +config.fillOpacity)
            .on('mouseover', function() {
                var currentClass = d3.select(this).attr('class');
                g.selectAll('circle')
                    .transition(200).style('opacity', function() {
                        return d3.select(this).classed(currentClass) ? 1 : 0;
                    });
                d3.select(this).transition(200).style('fill-opacity', 0.5);
            })
            .on('mouseout', function() {
                g.selectAll('circle').transition(200).style('opacity', 1);
                d3.select(this).transition(200).style('fill-opacity', +config.fillOpacity);
            })

            // Draw points
            g.selectAll(".nodes")
                .data(data).enter()
                    .append("svg:circle")
                    .attr("class", "radar-chart-series-"+series)
                    .attr('r', +config.pointSize)
                    .attr("alt", function(j){return Math.max(+j.measure[series].value, 0)})
                    .attr("cx", function(j, i){
                        dataValues.push([
                            width/2*(1-(parseFloat(Math.max(+j.measure[series].value, 0))/maxY[series])*Math.sin(i*radians/allCat.length)),
                            height/2*(1-(parseFloat(Math.max(+j.measure[series].value, 0))/maxY[series])*Math.cos(i*radians/allCat.length))
                        ]);
                    return width/2*(1-(Math.max(+j.measure[series].value, 0)/maxY[series])*Math.sin(i*radians/allCat.length));
                })
                .attr("cy", function(j, i){
                    return height/2*(1-(Math.max(+j.measure[series].value, 0)/maxY[series])*Math.cos(i*radians/allCat.length));
                })
                .attr("data-id", function(j){return j.category})
                .style("fill", colour(y.Name)).style("fill-opacity", .9)
                .on('mouseover', function(d, i) {
                    tooltip.displayList(d, 'category', 'measure', columnMap, d3.event, colour, d.measure[series].name);
                })
                .on('mouseout', function(d, i) {
                    tooltip.hide();
                })
    	});
    }

    return rmvpp;

 }(rmvpp || {}))
