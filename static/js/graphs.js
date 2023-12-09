queue()
    .defer(d3.json, "/donorschoose/projects")
    .defer(d3.json, "static/geojson/us-states.json")
    .await(makeGraphs);

function makeGraphs(error, projectsJson, statesJson) {
    if (error) {
        console.error("makeGraphs error on receiving data:", error);
        return;
    }

    // Clean projectsJson data
    var donorschooseProjects = projectsJson;
    var dateFormat = d3.time.format("%Y-%m-%d");
    donorschooseProjects.forEach(function(d) {
        d["date_posted"] = dateFormat.parse(d["date_posted"]);
        d["date_posted"].setDate(1);
        d["total_donations"] = +d["total_donations"]; // Convert to number
        // d["num_projects"] = +d["num_projects"]; 
    });

    // Create a Crossfilter instance
    var ndx = crossfilter(donorschooseProjects);

    // Define Dimensions
    var dateDim = ndx.dimension(function(d) { return d["date_posted"]; });
    var resourceTypeDim = ndx.dimension(function(d) { return d["resource_type"]; });
    var povertyLevelDim = ndx.dimension(function(d) { return d["poverty_level"]; });
    var stateDim = ndx.dimension(function(d) { return d["school_state"]; });
    var totalDonationsDim  = ndx.dimension(function(d) { return d["total_donations"]; });
    var gradeLevelDim = ndx.dimension(function(d) { return d["grade_level"]; });
    var totalDonationsByGrade = gradeLevelDim.group().reduceSum(function(d) { 
        return d["total_donations"]; 
    });

    // Calculate metrics
    var numProjectsByDate = dateDim.group(); 
    var numProjectsByResourceType = resourceTypeDim.group();
    var numProjectsByPovertyLevel = povertyLevelDim.group();
    var totalDonationsByState = stateDim.group().reduceSum(function(d) {
        return d["total_donations"];
    });

    // Groups for stacked chart
    var highPovertyGroup = resourceTypeDim.group().reduceSum(function(d) {
        return d.poverty_level === 'high' ? d.total_donations : 0;
    });
    var minimalPovertyGroup = resourceTypeDim.group().reduceSum(function(d) {
        return d.poverty_level === 'minimal' ? d.total_donations : 0;
    });
    var lowPovertyGroup = resourceTypeDim.group().reduceSum(function(d) {
        return d.poverty_level === 'low' ? d.total_donations : 0;
    });


    var all = ndx.groupAll();
    var totalDonations = ndx.groupAll().reduceSum(function(d) {return d["total_donations"];});

    var max_state = totalDonationsByState.top(1)[0].value;

    // Define values (to be used in charts)
    var minDate = dateDim.bottom(1)[0]["date_posted"];
    var maxDate = dateDim.top(1)[0]["date_posted"];

    // Charts
    var timeChart = dc.barChart("#time-chart");
    var resourceTypeChart = dc.rowChart("#resource-type-row-chart");
    var povertyLevelChart = dc.rowChart("#poverty-level-row-chart");
    var usChart = dc.geoChoroplethChart("#us-chart");
    var numberProjectsND = dc.numberDisplay("#number-projects-nd");
    var totalDonationsND = dc.numberDisplay("#total-donations-nd");
    var gradeLevelChart  = dc.barChart("#grade-level-chart");
    

    // Stacked Bar Chart for Resource Type and Poverty Level
    var resourceTypePovertyLevelChart = dc.barChart("#resource-type-poverty-level-chart");

	// Charts
	numberProjectsND
		.formatNumber(d3.format("d"))
		.valueAccessor(function(d){return d; })
		.group(all);

	totalDonationsND
		.formatNumber(d3.format("d"))
		.valueAccessor(function(d){return d; })
		.group(totalDonations)
		.formatNumber(d3.format(".3s"));

    
	timeChart
		.width(600)
		.height(160)
		.margins({top: 10, right: 50, bottom: 30, left: 50})
		.dimension(dateDim)
		.group(numProjectsByDate)
		.transitionDuration(500)
		.x(d3.time.scale().domain([minDate, maxDate]))
		.elasticY(true)
		.xAxisLabel("Year")
		.yAxis().ticks(4);

	resourceTypeChart
        .width(300)
        .height(250)
        .dimension(resourceTypeDim)
        .group(numProjectsByResourceType)
        .xAxis().ticks(4);

	povertyLevelChart
		.width(300)
		.height(250)
        .dimension(povertyLevelDim)
        .group(numProjectsByPovertyLevel)
        .xAxis().ticks(4);


	usChart.width(1000)
		.height(330)
		.dimension(stateDim)
		.group(totalDonationsByState)
		.colors(["#E2F2FF", "#C4E4FF", "#9ED2FF", "#81C5FF", "#6BBAFF", "#51AEFF", "#36A2FF", "#1E96FF", "#0089FF", "#0061B5"])
		.colorDomain([0, max_state])
		.overlayGeoJson(statesJson["features"], "state", function (d) {
			return d.properties.name;
		})
		.projection(d3.geo.albersUsa()
    				.scale(600)
    				.translate([340, 150]))
		.title(function (p) {
			return "State: " + p["key"]
					+ "\n"
					+ "Total Donations: " + Math.round(p["value"]) + " $";
		})

    // Configure the stacked bar chart
		resourceTypePovertyLevelChart
		.width(650)
		.height(450) // Increased height
		.dimension(resourceTypeDim)
		.group(highPovertyGroup, "High Poverty")
		.stack(lowPovertyGroup, "Low Poverty")
		.stack(minimalPovertyGroup, "Minimal Poverty")
		.x(d3.scale.ordinal())
		.xUnits(dc.units.ordinal)
		.xAxisLabel('Resource Type')
		.yAxisLabel('Total Donations')
		.legend(dc.legend().x(80).y(20).itemHeight(15).gap(5))
		.elasticY(true)
		.margins({top: 10, right: 50, bottom: 50, left: 50}) // Adjusted bottom margin
		.renderlet(function(chart){
			chart.selectAll('g.x text')
				.attr('class', 'x-axis-label')
		});

        gradeLevelChart
        .width(650)
        .height(450)
        .margins({top: 10, right: 50, bottom: 50, left: 50})
        .dimension(gradeLevelDim)
        .group(totalDonationsByGrade)
        .transitionDuration(500)
        .x(d3.scale.ordinal())
        .xUnits(dc.units.ordinal)
        .xAxisLabel("Grade Level")
        .yAxisLabel("Total Donations")
        .elasticY(true)
        .yAxis().ticks(6);

        var gradeMapping = {
            "Grades PreK-2": 1,
            "Grades 3-5": 2,
            // ... other grade levels
        };
        var gradeLevelDim = ndx.dimension(function(d) {
            return gradeMapping[d["grade_level"]];
        });
        var gradeLevelLineChart = dc.lineChart("#grade-level-line-chart");
        gradeLevelLineChart
        .width(650)
        .height(450)
        .margins({top: 10, right: 50, bottom: 50, left: 50})
        .dimension(gradeLevelDim)
        .group(totalDonationsByGrade)
        .transitionDuration(500)
        .x(d3.scale.linear().domain([1, Object.keys(gradeMapping).length])) // Modify based on the number of grade levels
        .elasticY(true)
        .xAxisLabel("Grade Level")
        .yAxisLabel("Total Donations")
        .yAxis().ticks(6);

    
    //     var dateDim = ndx.dimension(function(d) { return d["date_posted"]; });
    //     var povertyLevelDim = ndx.dimension(function(d) { return d["poverty_level"]; });
    //     // ... other dimensions ...
    
    //     // Define groups for each poverty level
    //     function reduceSumByPovertyLevel(povertyLevel) {
    //         return function(d) {
    //             return d.poverty_level === povertyLevel ? d.num_projects : 0;
    //         };
    //     }
    
    //     var numProjectsByDateHighPoverty = dateDim.group().reduceSum(reduceSumByPovertyLevel('high'));
    //     var numProjectsByDateLowPoverty = dateDim.group().reduceSum(reduceSumByPovertyLevel('low'));
    //     var numProjectsByDateModeratePoverty = dateDim.group().reduceSum(reduceSumByPovertyLevel('moderate'));
    //     // ... groups for other poverty levels if needed ...
    
    //     // Define min and max dates
    //     var minDate = dateDim.bottom(1)[0]["date_posted"];
    //     var maxDate = dateDim.top(1)[0]["date_posted"];
    
    //     // Trend Line Chart for Number of Projects Over Time by Poverty Level
    //     var projectsTrendChart = dc.compositeChart("#projects-trend-chart");
    
    //     projectsTrendChart
    //         .width(600)
    //         .height(400)
    //         .margins({top: 30, right: 50, bottom: 25, left: 50})
    //         .dimension(dateDim)
    //         .x(d3.time.scale().domain([minDate, maxDate]))
    //         .yAxisLabel("Number of Projects")
    //         .legend(dc.legend().x(80).y(20).itemHeight(13).gap(5))
    //         .renderHorizontalGridLines(true)
    //         .compose([
    //             dc.lineChart(projectsTrendChart)
    //                 .group(numProjectsByDateHighPoverty, 'High Poverty'),
    //             dc.lineChart(projectsTrendChart)
    //                 .group(numProjectsByDateLowPoverty, 'Low Poverty'),
    //             dc.lineChart(projectsTrendChart)
    //                 .group(numProjectsByDateModeratePoverty, 'Moderate Poverty')
    //             // ... add other lines for different poverty levels ...
    //         ])
    //         .brushOn(false)
    //         .elasticY(true)
    //         .colors(d3.scale.ordinal().range(['red', 'green', 'blue']))
    // .colorAccessor(function(d, i) { return i; }) // Assign different colors based on index
    // .xAxis().tickFormat(d3.time.format('%Y'));  

    // Render all the charts
    dc.renderAll();
}