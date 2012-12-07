/*global console, Ext */
Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    items: [ 
	    { xtype: 'container', padding: 10, layout: { type: 'hbox' }, items: [
            {xtype: 'container', itemId: 'selector_box', padding: 5 },
            {xtype: 'container', itemId: 'tag_box', padding: 5 },
            {xtype: 'container', itemId: 'type_box', padding: 5 }
	    ]
	    },
        
        {xtype: 'container', itemId: 'chart_box'}, 
        {xtype:'container',itemId:'table_box', padding: 10 } 
    ],
    valid_verdicts: [ "Not Run" ],
    timebox: null,
    selected_tags: [],
    other_selections: {
        'Type': null,
        'Priority': null
    },
    launch: function() {
        this._set30Days();
        this._addSelectors();
        this._getVerdictNamesAndRefreshResults();
    },
    _set30Days: function() {
        this.title = "Test Case Results Last 30 days";
        this.first_day = Rally.util.DateTime.toIsoString( Rally.util.DateTime.add( new Date(), "day", -30 ), true).replace(/T[\W\w]*/,"");
        this.last_day = Rally.util.DateTime.toIsoString( new Date(), false ).replace(/T[\W\w]*/,"");
    },
    _addSelectors: function() {
        var that = this;
        var range_types = Ext.create('Ext.data.Store',{
            fields: ['name'],
            data: [
            { 'name': '30 days' },
            { 'name': 'Iteration' },
            { 'name': 'Release' }
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
        this.down('#tag_box').add(Ext.create('Rally.ui.picker.TagPicker',{
            fieldLabel: 'Tag(s):',
            labelAlign: 'right',
            listeners: {
                selectionchange: function( field, values, options ) {
                    that.selected_tags = values;
                    that._getTestResults();
                }
            }
        }));

        this._addDropdownWithAll('Type', 'type_box');
    },
    _addDropdownWithAll: function( fieldName, elementName ) {
	    var all_value = { 
	        name: '-- All --',
	        value: '-- All --'
	    };

        this.down('#'+elementName).add(Ext.create('Rally.ui.combobox.AttributeComboBox',{
            model: 'TestCase',
            field: fieldName,
            valueNotFoundText: "buh",
            itemId: elementName + "_drop",
            fieldLabel: fieldName + ":",
            labelAlign: "right",
            // TODO: add listener
            // TODO: add <<All>>
            listeners: {
                change: function( box, newValue, oldValue, options ) {
                    console.log( "change", newValue );
                    this.other_selections[fieldName] = newValue;
                    this._getTestResults();
                },
                scope: this
            },
            storeConfig: {
                autoLoad: true,
                listeners: {
                    load: function(store,records) {
                        console.log( "type store", store);
                        store.insert(0,all_value);
                        this.down('#' + elementName + '_drop').setValue(all_value.value);
                    },
                    scope: this
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
                        
                        that.timebox = field.getRecord().data;
                        that.title = "Test Case Results by Iteration: " + that.timebox.Name;
                        that.first_day =  Rally.util.DateTime.toIsoString( that.timebox.StartDate ) ;
                        that.last_day =  Rally.util.DateTime.toIsoString( that.timebox.EndDate );
                        that._getTestResults();
                    },
                    change: function( field, newValue, oldValue, eOpts ) {
                        
                        that.timebox = field.getRecord().data;
                        that.title = "Test Case Results by Iteration: " + that.timebox.Name;
                        that.first_day =  Rally.util.DateTime.toIsoString( that.timebox.StartDate ) ;
                        that.last_day =  Rally.util.DateTime.toIsoString( that.timebox.EndDate );
                        that._getTestResults();
                    }
                }
            });

	        
	        this.down('#selector_box').add(this.subselector);
        } else if ( rangeType == "Release" ) {
	        this.subselector = Ext.create('Rally.ui.combobox.ReleaseComboBox',{
	            value: null,
	            listeners: {
	                ready: function( field ) {
	                    console.log( field.getRecord() );
	                    
	                    that.timebox = field.getRecord().data;
	                    that.title = "Test Case Results by Release: " + that.timebox.Name;
	                    that.first_day =  Rally.util.DateTime.toIsoString( that.timebox.ReleaseStartDate ) ;
	                    that.last_day =  Rally.util.DateTime.toIsoString( that.timebox.ReleaseDate );
	                    that._getTestResults();
	                },
	                change: function( field, newValue, oldValue, eOpts ) {
	                    console.log( field.getRecord() );
	                    
	                    that.timebox = field.getRecord().data;
	                    that.title = "Test Case Results by Release: " + that.timebox.Name;
	                    that.first_day =  Rally.util.DateTime.toIsoString( that.timebox.ReleaseStartDate ) ;
	                    that.last_day =  Rally.util.DateTime.toIsoString( that.timebox.ReleaseDate );
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
        var filters = null;
        var that = this;
        
        this.title = this.title.replace(/ \(Only tags[\W\w]*/,"");
        
        if ( this.timebox ) {
            // can't limit test cases by timebox here, but can limit how much data we get back.
            filters = Ext.create('Rally.data.QueryFilter', {
                property: 'WorkProduct.ObjectID',
                operator: ">",
                value: 0
            });
        }
        
        if ( this.selected_tags.length > 0 ) {
            var tags = this.selected_tags;
            var tag_filter = null;
            
            Ext.Array.each( tags, function(tag) {
                console.log( "tag", tag._ref );
                if ( ! tag_filter ) {
                     that.title += " (Only tags: " + tag.Name;
                    tag_filter = Ext.create('Rally.data.QueryFilter', {
		                property: 'Tags', 
		                operator: 'contains', 
		                value: tag._ref 
		            });
                } else {
                    that.title += ", " + tag.Name;
	                tag_filter = tag_filter.or(Ext.create('Rally.data.QueryFilter', {
	                    property: 'Tags', 
	                    operator: 'contains', 
	                    value: tag._ref
	                }));
                }
            });

            that.title += ")";
            if ( !filters ) {
                filters = tag_filter;
            } else {
                filters = filters.and( tag_filter );
            }
        }
        
        if ( this.other_selections.Type && this.other_selections.Type !== "-- All --" ) {
            if ( !filters ) {
                filters = Ext.create( 'Rally.data.QueryFilter',{
                    property: 'Type',
                    operator: '=',
                    value: that.other_selections.Type
                });
            } else {
                filters = filters.and(Ext.create( 'Rally.data.QueryFilter',{
                    property: 'Type',
                    operator: '=',
                    value: that.other_selections.Type
                }));
            }
        }
        if ( filters === null ) { filters = []; } else { console.log( filters.toString()); }
        
    	Ext.create('Rally.data.WsapiDataStore', {
    		model: 'TestCase',
            filters: filters,
    		listeners: {
    			scope: this,
    			load: function(store,data,success) {
    				var tc_result_counts = {};
    				Ext.Array.each( data, function( tc ) {
                        if ( that.isTestCaseInTimebox(tc,that.timebox) ) {
    					   tc_result_counts[ tc.data.FormattedID ] = that.getVerdictsByDay(tc.data.Results, Rally.util.DateTime.toIsoString(tc.data.CreationDate, false)); 
                        }
                    });
    				var tc_result_counts_by_date = that.getResultCountsByDate( tc_result_counts );
                    that.makeChart(tc_result_counts_by_date);
                    that.makeTable(tc_result_counts_by_date);
    			}
    		},
    		fetch: ['Name','FormattedID','Results','Date','Verdict','CreationDate','Iteration','Release','WorkProduct'],
    		autoLoad: true
    	});
    },
    isTestCaseInTimebox: function( tc, timebox ) {
        var result = false;
        if ( !timebox ) {
            result = true;
        } else if ( timebox.Name && tc.data.WorkProduct && tc.data.WorkProduct.Iteration && tc.data.WorkProduct.Iteration.Name == timebox.Name ) {
            result = true;
        } else if ( timebox.Name && tc.data.WorkProduct && tc.data.WorkProduct.Release && tc.data.WorkProduct.Release.Name == timebox.Name ) {
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

    makeTable: function(tc_result_counts_by_date) {
        if ( this.table ) { this.table.destroy(); }
        var table_data = [];
        var columns = [{ text: 'Date', dataIndex: 'RunDate' }];
        var data_template = {};
        Ext.Array.each( this.valid_verdicts, function(verdict) {
            columns.push({ text: verdict, dataIndex: verdict });
            data_template[ verdict ] = 0;
        });
        
        for ( var run_date in tc_result_counts_by_date ) {
            if (tc_result_counts_by_date.hasOwnProperty(run_date) ) {
                var data_item = Ext.clone( data_template );
                data_item['RunDate'] = run_date;
                var counts = tc_result_counts_by_date[run_date];
                Ext.Array.each( this.valid_verdicts, function(verdict) {
                    if ( counts[verdict] ) {
                        data_item[verdict] = counts[verdict];
                    }
                });
                table_data.push(data_item);
            }
        }
        console.log( table_data );
        console.log( columns );
        var table_store = Ext.create('Rally.data.custom.Store', {
            data: table_data
        });
        
        this.table = Ext.create('Rally.ui.grid.Grid',{
            store: table_store,
            columnCfgs: columns
        });
        this.down('#table_box').add(this.table);
    },
    makeChart: function(tc_result_counts_by_date) {
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
        console.log(tc_result_counts_by_date,series_array);
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
