/*global console, Ext */
Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    items: [ 
        {xtype: 'container', itemId: 'selector_box', padding: 10 },
        {xtype: 'container', itemId: 'chart_box'}, 
        {xtype:'container',itemId:'table_box'} 
    ],
    valid_verdicts: [ "Not Run" ],
    timebox: null,
    launch: function() {
        this._set30Days();
        this._addSelectors();
        this._getVerdictNamesAndRefreshResults();
    },
    _set30Days: function() {
        this.title = "Test Case Results Last 30 days";
        this.first_day = Rally.util.DateTime.toIsoString( Rally.util.DateTime.add( new Date(), "day", -30 ));
        this.last_day = Rally.util.DateTime.toIsoString( new Date(), false );
    },
    _addSelectors: function() {
        var that = this;
        var range_types = Ext.create('Ext.data.Store',{
            fields: ['name'],
            data: [
            { 'name': '30 days' },
            { 'name': 'Iteration' }
            ]
        });
        this.down('#selector_box').add(Ext.create('Ext.form.ComboBox', {
            fieldLabel: '',
            store: range_types,
            queryMode: 'local',
            displayField: 'name',
            valueField: 'name',
            value: '30 days',
            listeners: {
                change: function( field, newValue, oldValue, opts ) {
                    that._addSubSelector(newValue);
                }
            }
        }));
    },
    _addSubSelector: function( rangeType ) {
        var that = this;
        if ( this.subselector ) { 
            this.subselector.destroy();
        }
        if ( rangeType == "Iteration" ) {
	        this.subselector = Ext.create('Rally.ui.combobox.IterationComboBox',{
                value: null,
                listeners: {
                    ready: function( field ) {
                        console.log( field.getRecord() );
                        that.timebox = field.getRecord().data;
                        that.title = "Test Case Results by Iteration: " + that.timebox.Name;
                        that.first_day =  Rally.util.DateTime.toIsoString( that.timebox.StartDate ) ;
                        that.last_day =  Rally.util.DateTime.toIsoString( that.timebox.EndDate );
                        that._getTestResults();
                    },
                    change: function( field, newValue, oldValue, eOpts ) {
                        console.log( field.getRecord() );
                        
                        that.timebox = field.getRecord().data;
                        that.title = "Test Case Results by Iteration: " + that.timebox.Name;
                        that.first_day =  Rally.util.DateTime.toIsoString( that.timebox.StartDate ) ;
                        that.last_day =  Rally.util.DateTime.toIsoString( that.timebox.EndDate );
                        that._getTestResults();
                    }
                }
            });
	        
	        this.down('#selector_box').add(this.subselector);
        } else {
            this.timebox = null;
            this._set30Days();
            this._getVerdictNamesAndRefreshResults();
        }
    },
    _getVerdictNamesAndRefreshResults: function() {
        var that = this;
        
        if ( this.valid_verdicts.length == 1 ) {
	        Rally.data.ModelFactory.getModel({
	            type: 'TestCaseResult',
	            success: function(model) {
	                var verdicts = model.getField("Verdict").allowedValues;
	                Ext.Array.each( verdicts, function( verdict ) {
	                    that.valid_verdicts.push( verdict.StringValue );
	                });
	                that._getTestResults();
	            }
	        });
        } else {
            that._getTestResults();
        }
    },
    _getTestResults: function() {
        var filters = [];
        var that = this;
        if ( this.timebox ) {
            // can't limit test cases by timebox here, but can limit how much data we get back.
            filters = [{
                property: 'WorkProduct.ObjectID',
                operator: ">",
                value: 0
            }];
        }
    	Ext.create('Rally.data.WsapiDataStore', {
    		model: 'TestCase',
            filters: filters,
    		listeners: {
    			scope: this,
    			load: function(store,data,success) {
                    console.log( this.first_day, this.last_day );
    				var tc_result_counts = {};
    				Ext.Array.each( data, function( tc ) {
                        if ( that.isTestCaseInTimebox(tc,that.timebox) ) {
    					   tc_result_counts[ tc.data.FormattedID ] = that.getVerdictsByDay(tc.data.Results, Rally.util.DateTime.toIsoString(tc.data.CreationDate, false)); 
                        }
                    });
    				var tc_result_counts_by_date = that.getResultCountsByDate( tc_result_counts );
                    that.makeChart(tc_result_counts_by_date);
    			}
    		},
    		fetch: ['Name','FormattedID','Results','Date','Verdict','CreationDate','Iteration','Release','WorkProduct'],
    		autoLoad: true
    	});
    },
    isTestCaseInTimebox: function( tc, timebox ) {
        var result = false;
        console.log( timebox, tc );
        if ( !timebox ) {
            result = true;
        } else if ( timebox.Name && tc.data.WorkProduct && tc.data.WorkProduct.Iteration && tc.data.WorkProduct.Iteration.Name == timebox.Name ) {
            result = true;
        }
        return result;
    },
    /* given an array of test case results,  
     * return a hash where key is date and value is the last verdict that day
     */
    getVerdictsByDay: function( results, creation_date ) {
    	var tc_verdicts_by_day = {};

    	Ext.Array.each( results, function(tcr) {
    		// adjust date for timezone, remove time
    		var run_date = Rally.util.DateTime.toIsoString(Rally.util.DateTime.fromIsoString(tcr.Date), false).replace(/T[\W\w]*/,"");
    		tc_verdicts_by_day[ run_date ] = tcr.Verdict;
    	});
        var earliest_day = this.first_day;
        if ( earliest_day < creation_date ) { earliest_day = creation_date.replace(/T[\W\w]*/,""); }
    	tc_verdicts_by_day = this.fillInDates(earliest_day,this.last_day,tc_verdicts_by_day);
        
    	return tc_verdicts_by_day;
    },
    /*
     * given a hash of verdicts (key is TC id, value is hash of verdicts (key is date, value is verdict))
     * returns a count of verdicts by date
     */
    getResultCountsByDate: function( tc_result_counts ) {
    	var counts = {}; // key is date
    	for ( var tc in tc_result_counts ) {
    		if ( tc_result_counts.hasOwnProperty(tc) ) {
    			var tc_results = tc_result_counts[tc];
    			for ( var run_date in tc_results ) {
    				var verdict = tc_results[run_date];
    				
    				if ( tc_results.hasOwnProperty(run_date) ) {
    					if ( !counts[run_date] ) {
    						counts[run_date] = { "Not Run": 0 };
    					}
    					if ( !counts[run_date][verdict] ) {
    						counts[run_date][verdict] = 0;
    					}
    					counts[run_date][verdict] += 1;
    				}
    			}
    		}
    	}
    	return counts;
    },
    fillInDates: function(first_day,last_day,tc_verdicts_by_day){
    	var filled_day = {};
    	var day = first_day;
    	var current_verdict = null;
		while ( day <= last_day ) {
			if ( tc_verdicts_by_day[day] ) {
				current_verdict = tc_verdicts_by_day[day];
				filled_day[day] = current_verdict;
			} else {
				filled_day[day] = "Not Run";
				if ( current_verdict ) {
					filled_day[day] = current_verdict;
				}
			}
			day = Rally.util.DateTime.toIsoString(Rally.util.DateTime.add(Rally.util.DateTime.fromIsoString(day), "day", 1),true).replace(/T[\W\w]*/,"");
    	}
    	return filled_day;
    },
    makeChart: function(tc_result_counts_by_date) {
        // switch to an array of series(es?)
        var series = {};
        var series_array = [];
        Ext.Array.each( this.valid_verdicts, function(verdict) {
            series[verdict] = { 
                type: 'column',
                name: verdict,
                data: []
            }
        });
        for ( var run_date in tc_result_counts_by_date ) {
            if ( tc_result_counts_by_date.hasOwnProperty(run_date) ) {
                var js_date = Rally.util.DateTime.fromIsoString(run_date);
                var counts = tc_result_counts_by_date[run_date];
                Ext.Array.each( this.valid_verdicts, function(verdict) {
                    if ( counts[verdict] ) {
                        series[verdict].data.push( [ js_date.getTime(), counts[verdict] ] );
                    }
                });
            }
        }
        
        for ( var i in series ) {
            if ( series.hasOwnProperty(i) ) {
                series_array.push(series[i]);
            }
        }
        console.log(series);
        if ( this.chart ) { this.chart.destroy(); }
        this.chart = Ext.create( 'Rally.ui.chart.Chart', {
            chartConfig: {
                chart: {},
                title: { text:  this.title, align: 'center' },
                xAxis: { type: 'datetime' },
                plotOptions: { column: { stacking: 'normal' } },
                series: series_array
            }
        });
        this.down('#chart_box').add(this.chart);
    }
});
