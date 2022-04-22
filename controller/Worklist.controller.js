/*global location history */
sap.ui.define([
  "ZACBACSMGREP/controller/BaseController",
  "sap/ui/model/json/JSONModel",
  "sap/ui/core/routing/History",
  "ZACBACSMGREP/model/formatter",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator"
], function(BaseController, JSONModel, History, formatter, Filter, FilterOperator) {
  "use strict";

  return BaseController.extend("ZACBACSMGREP.controller.Worklist", {

    formatter: formatter,

    /* =========================================================== */
    /* lifecycle methods                                           */
    /* =========================================================== */

    /**
     * Called when the worklist controller is instantiated.
     * @public
     */
    onInit: function() {
      var oViewModel,
        iOriginalBusyDelay,
        oTable = this.byId("table");

      // Put down worklist table's original value for busy indicator delay,
      // so it can be restored later on. Busy handling on the table is
      // taken care of by the table itself.
      iOriginalBusyDelay = oTable.getBusyIndicatorDelay();
      // keeps the search state
      this._aTableSearchState = [];

      // Model used to manipulate control states
      oViewModel = new JSONModel({
        worklistTableTitle: this.getResourceBundle().getText("worklistTableTitle"),
        saveAsTileTitle: this.getResourceBundle().getText("saveAsTileTitle", this.getResourceBundle().getText("worklistViewTitle")),
        shareOnJamTitle: this.getResourceBundle().getText("worklistTitle"),
        shareSendEmailSubject: this.getResourceBundle().getText("shareSendEmailWorklistSubject"),
        shareSendEmailMessage: this.getResourceBundle().getText("shareSendEmailWorklistMessage", [location.href]),
        tableNoDataText: this.getResourceBundle().getText("tableNoDataText"),
        tableBusyDelay: 0
      });
      this.setModel(oViewModel, "worklistView");

      this.setInitialDate();
      this.globalFilter = [];

      // Make sure, busy indication is showing immediately so there is no
      // break after the busy indication for loading the view's meta data is
      // ended (see promise 'oWhenMetadataIsLoaded' in AppController)
      oTable.attachEventOnce("updateFinished", function() {
        // Restore original busy indicator delay for worklist's table
        oViewModel.setProperty("/tableBusyDelay", iOriginalBusyDelay);
      });
      // Add the worklist page to the flp routing history
      this.addHistoryEntry({
        title: this.getResourceBundle().getText("worklistViewTitle"),
        icon: "sap-icon://table-view",
        intent: "#ACBACaseManagementReporting-display"
      }, true);

    },

    /* =========================================================== */
    /* event handlers                                              */
    /* =========================================================== */

    /**
     * Triggered by the table's 'updateFinished' event: after new table
     * data is available, this handler method updates the table counter.
     * This should only happen if the update was successful, which is
     * why this handler is attached to 'updateFinished' and not to the
     * table's list binding's 'dataReceived' method.
     * @param {sap.ui.base.Event} oEvent the update finished event
     * @public
     */
    onUpdateFinished: function(oEvent) {
      // update the worklist's object counter after the table update
      var sTitle,
        oTable = oEvent.getSource(),
        iTotalItems = oEvent.getParameter("total");
      // only update the counter if the length is final and
      // the table is not empty
      if (iTotalItems && oTable.getBinding("items").isLengthFinal()) {
        sTitle = this.getResourceBundle().getText("worklistTableTitleCount", [iTotalItems]);
      } else {
        sTitle = this.getResourceBundle().getText("worklistTableTitle");
      }
      this.getModel("worklistView").setProperty("/worklistTableTitle", sTitle);

    },

    /**
     * Event handler when a table item gets pressed
     * @param {sap.ui.base.Event} oEvent the table selectionChange event
     * @public
     */
    onPress: function(oEvent) {
      // The source is the list item that got pressed
      this._showObject(oEvent.getSource());
    },

    /**
     * Event handler when the share in JAM button has been clicked
     * @public
     */
    onShareInJamPress: function() {
      var oViewModel = this.getModel("worklistView"),
        oShareDialog = sap.ui.getCore().createComponent({
          name: "sap.collaboration.components.fiori.sharing.dialog",
          settings: {
            object: {
              id: location.href,
              share: oViewModel.getProperty("/shareOnJamTitle")
            }
          }
        });
      oShareDialog.open();
    },
    onUpdateStarted: function() {

    },
    setInitialDate: function() {

      // Start of timeframe filter filling
      // Filling timeframe filter by January 1st two years ago and today

      var today = new Date();

      var monthFrom = 0; //January is 0!
      var yearFrom = today.getFullYear() - 2;

      monthFrom = monthFrom + 1;
      var dateFrom = (yearFrom + '-' + monthFrom + '-' + '01');

      // Bringing both dates to a similar format

      var dateFormat = sap.ui.core.format.DateFormat.getDateInstance({
        pattern: "yyyy-MM-dd"
      });
      var dateTo = dateFormat.format(today);

      this.getView().byId("DateRangeSelector").setDateValue(new Date(dateFrom));
      this.getView().byId("DateRangeSelector").setSecondDateValue(new Date(dateTo));

      // End of timeframe filter filling
    },
    onSearch: function() {

      // Filter processing block

      var dateFrom = this.getView().byId("DateRangeSelector").getDateValue();
      var dateTo = this.getView().byId("DateRangeSelector").getSecondDateValue();

      var D = new Date(dateFrom);
      var t = D.getTimezoneOffset();
      D.setMinutes(D.getMinutes() - t);

      var e = new Date(dateTo);
      e.setMinutes(e.getMinutes() - t);

      var aTableSearchState = [];

      // Filter by dates

      aTableSearchState = [
        new Filter("DateFrom", FilterOperator.GE, D),
        new Filter("DateTo", FilterOperator.LE, e)
      ];

      // Multiinput processing
      // Get array of Tokens

      var aTokens = this.getView().byId("multiInput").getTokens();

      // Filter by organization units
      $.each(aTokens, function(i, oTokens) {

        aTableSearchState.push(
          new Filter({
            path: "Function",
            operator: sap.ui.model.FilterOperator.EQ,
            value1: oTokens.getKey()
          }));
      });

      this.globalFilter = aTableSearchState;
      this._applySearch(aTableSearchState);

    },
    handleDateRangeChange: function(oEvent) {
      var sFrom = oEvent.getParameter("from"),
        sTo = oEvent.getParameter("to"),
        bValid = oEvent.getParameter("valid"),
        oEventSource = oEvent.getSource(),
        oText = this.byId("TextEvent");

      this._iEvent++;

      oText.setText("Id: " + oEventSource.getId() + "\nFrom: " + sFrom + "\nTo: " + sTo);

      if (bValid) {
        oEventSource.setValueState(this.ValueState.None);
      } else {
        oEventSource.setValueState(this.ValueState.Error);
      }
    },

    onShowGraphPress: function(oEvent) {

      this.graphPage = sap.ui.xmlfragment("ZACBACSMGREP.view.GraphPage", this);

      this.getView().addDependent(this.graphPage);

      this.graphPage.open();

      // Excluding null Functions from graph

      var oList = this.byId("table");
      var notEmptyFunction = [];
      var graphFilter = [];

      for (var i = 0; i < oList.getItems().length; i++) {

        if (oList.getItems()[i].getBindingContext().getProperty("Function") !== 'null') {
          var excludedOrgUnit = oList.getItems()[i].getBindingContext().getProperty("OrgUnit");

          notEmptyFunction.push(
            new Filter({
              path: "Function",
              operator: sap.ui.model.FilterOperator.EQ,
              value1: excludedOrgUnit
            }));
        } // if (oList.getItems()[i].getBindingContext().getProperty("Function") == 'null')
      } // for (var i = 0; i < oList.getItems().length; i++)

      ////Passing global filter to graph fragment additionally

      if (this.globalFilter && this.globalFilter.length > 0) {

        graphFilter = this.globalFilter.concat(notEmptyFunction);

        this.graphPage.getContent()[0].getItems()[0].getContent()[0].getContent().getDataset().getBinding("data").filter(graphFilter);

      } else

      {
        this.graphPage.getContent()[0].getItems()[0].getContent()[0].getContent().getDataset().getBinding("data").filter(notEmptyFunction);
      }

    },

    closeGraphPage: function(oEvent) {
      this.graphPage.destroy(true);
    },

    /**
     * Event handler for refresh event. Keeps filter, sort
     * and group settings and refreshes the list binding.
     * @public
     */
    onRefresh: function() {
      var oTable = this.byId("table");
      oTable.getBinding("items").refresh();
    },

    /* =========================================================== */
    /* internal methods                                            */
    /* =========================================================== */

    /**
     * Shows the selected item on the object page
     * On phones a additional history entry is created
     * @param {sap.m.ObjectListItem} oItem selected Item
     * @private
     */
    _showObject: function(oItem) {

      var dateFrom = this.getView().byId("DateRangeSelector").getDateValue();
      var dateTo = this.getView().byId("DateRangeSelector").getSecondDateValue();

      var D = new Date(dateFrom);
      var t = D.getTimezoneOffset();
      D.setMinutes(D.getMinutes() - t);

      var e = new Date(dateTo);
      e.setMinutes(e.getMinutes() - t);

      this.getRouter().navTo("object", {
        objectId: oItem.getBindingContext().getProperty("OrgUnit")
      });
    },

    /**
     * Internal helper method to apply both filter and search state together on the list binding
     * @param {sap.ui.model.Filter[]} aTableSearchState An array of filters for the search
     * @private
     */
    _applySearch: function(aTableSearchState) {
      var oTable = this.byId("table"),
        oViewModel = this.getModel("worklistView");
      oTable.getBinding("items").filter(aTableSearchState, "Application");
      // changes the noDataText of the list in case there are no filter results
      if (aTableSearchState.length !== 0) {
        oViewModel.setProperty("/tableNoDataText", this.getResourceBundle().getText("worklistNoDataWithSearchText"));
      }
    }

  });
});