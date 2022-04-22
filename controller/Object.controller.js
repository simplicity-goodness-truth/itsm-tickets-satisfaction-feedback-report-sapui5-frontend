/*global location*/
sap.ui.define([
  "ZACBACSMGREP/controller/BaseController",
  "sap/ui/model/json/JSONModel",
  "sap/ui/core/routing/History",
  "ZACBACSMGREP/model/formatter",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/ui/model/Sorter"
], function(
  BaseController,
  JSONModel,
  History,
  formatter,
  Filter,
  FilterOperator,
  Sorter
) {
  "use strict";

  return BaseController.extend("ZACBACSMGREP.controller.Object", {

    formatter: formatter,

    // Declaration of options popover

    _oResponsivePopover: null,

    /* =========================================================== */
    /* lifecycle methods                                           */
    /* =========================================================== */

    /**
     * Called when the worklist controller is instantiated.
     * @public
     */

    onInit: function() {
      // Model used to manipulate control states. The chosen values make sure,
      // detail page is busy indication immediately so there is no break in
      // between the busy indication for loading the view's meta data
      var iOriginalBusyDelay,
        oViewModel = new JSONModel({
          busy: true,
          delay: 0
        });

      this.getRouter().getRoute("object").attachPatternMatched(this._onObjectMatched, this);

      // Store original busy indicator delay, so it can be restored later on
      iOriginalBusyDelay = this.getView().getBusyIndicatorDelay();
      this.setModel(oViewModel, "objectView");
      this.getOwnerComponent().getModel().metadataLoaded().then(function() {
        // Restore original busy indicator delay for the object view
        oViewModel.setProperty("/delay", iOriginalBusyDelay);
      });

      // Listener on header click

      var oTable = this.getView().byId("CaseTable");
      var t = this;
      oTable.addEventDelegate({
        onAfterRendering: function() {
          var oHeader = this.$().find(".sapMListTblHeaderCell"); //Get hold of table header elements

          for (var i = 0; i < oHeader.length; i++) {
            var oID = oHeader[i].id;
            t.onHeaderClick(oID);
          }
        }
      }, oTable);

      // Link to options fragment

      if (!this._oResponsivePopover) {
        this._oResponsivePopover = sap.ui.xmlfragment("ZACBACSMGREP.view.Options", this);
        this._oResponsivePopover.setModel(this.getView().getModel());
      }

    },

    /* =========================================================== */
    /* event handlers                                              */
    /* =========================================================== */

    /**
     * Event handler when the share in JAM button has been clicked
     * @public
     */
    onShareInJamPress: function() {
      var oViewModel = this.getModel("objectView"),
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

    onHeaderClick: function(oID) {

      var t = this;
      $("#" + oID).click(function(oEvent) { //Attach Table Header Element Event
        var oTarget = oEvent.currentTarget; //Get hold of Header Element

        var oLabelText = oTarget.childNodes[0].textContent; //Get Column Header text

        if (oLabelText === 'Rating') {

          t._oResponsivePopover.openBy(oTarget);

        }

      });
    },
    onAscending: function() {
      var oRatingSorter = new Sorter({
        path: "Rating",
        descending: false
      });
      var oTable = this.getView().byId("CaseTable");
      oTable.getBinding("items").sort(oRatingSorter);
      this._oResponsivePopover.close();
    },

    onDescending: function() {
      var oRatingSorter = new Sorter({
        path: "Rating",
        descending: true
      });
      var oTable = this.getView().byId("CaseTable");
      oTable.getBinding("items").sort(oRatingSorter);
      this._oResponsivePopover.close();
    },
    onFilter: function(oEvent) {
      var oValue = oEvent.getParameter("value");
      var oViewModel = this.getModel("worklistView");
      
      if (!oValue) {
        oValue = "0";
      }
      
      if ((oValue.indexOf("e") === -1 ) && (oValue <= 5))  {

        // Filter by rating

        var aRatingFilter = [
          new Filter("Rating", FilterOperator.EQ, oValue)
        ];

        var oTable = this.getView().byId("CaseTable");
          
        oTable.getBinding("items").filter(aRatingFilter, "Application");

      }

      this._oResponsivePopover.close();
    },

    /* =========================================================== */
    /* internal methods                                            */
    /* =========================================================== */

    /**
     * Binds the view to the object path.
     * @function
     * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
     * @private
     */
    _onObjectMatched: function(oEvent) {
      var sObjectId = oEvent.getParameter("arguments").objectId;

      this.getModel().metadataLoaded().then(function() {
        var sObjectPath = this.getModel().createKey("DivisionSet", {
          OrgUnit: sObjectId
        });
        this._bindView("/" + sObjectPath);

      }.bind(this));
    },

    /**
     * Binds the view to the object path.
     * @function
     * @param {string} sObjectPath path to the object to be bound
     * @private
     */
    _bindView: function(sObjectPath) {
      var oViewModel = this.getModel("objectView"),
        oDataModel = this.getModel();

      this.getView().bindElement({
        path: sObjectPath,
        events: {
          change: this._onBindingChange.bind(this),
          dataRequested: function() {
            oDataModel.metadataLoaded().then(function() {
              // Busy indicator on view should only be set if metadata is loaded,
              // otherwise there may be two busy indications next to each other on the
              // screen. This happens because route matched handler already calls '_bindView'
              // while metadata is loaded.
              oViewModel.setProperty("/busy", true);
            });
          },
          dataReceived: function() {
            oViewModel.setProperty("/busy", false);
          }
        }
      });
    },

    _onBindingChange: function() {
      var oView = this.getView(),
        oViewModel = this.getModel("objectView"),
        oElementBinding = oView.getElementBinding();

      // No data for the binding
      if (!oElementBinding.getBoundContext()) {
        this.getRouter().getTargets().display("objectNotFound");
        return;
      }

      var oResourceBundle = this.getResourceBundle(),
        oObject = oView.getBindingContext().getObject(),
        sObjectId = oObject.OrgUnit,
        sObjectName = oObject.Function;

      // Applying a filter to pass dates

      var aTableSearchState = [];

      aTableSearchState = [
        new Filter("DateFrom", FilterOperator.GE, oObject.DateFrom),
        new Filter("DateTo", FilterOperator.LE, oObject.DateTo)
      ];

      var oTable = this.byId("CaseTable");
      oTable.getBinding("items").filter(aTableSearchState, "Application");

      oViewModel.setProperty("/busy", false);
      // Add the object page to the flp routing history
      this.addHistoryEntry({
        title: this.getResourceBundle().getText("objectTitle") + " - " + sObjectName,
        icon: "sap-icon://enter-more",
        intent: "#ACBACaseManagementReporting-display&/DivisionSet/" + sObjectId
      });

      oViewModel.setProperty("/saveAsTileTitle", oResourceBundle.getText("saveAsTileTitle", [sObjectName]));
      oViewModel.setProperty("/shareOnJamTitle", sObjectName);
      oViewModel.setProperty("/shareSendEmailSubject",
        oResourceBundle.getText("shareSendEmailObjectSubject", [sObjectId]));
      oViewModel.setProperty("/shareSendEmailMessage",
        oResourceBundle.getText("shareSendEmailObjectMessage", [sObjectName, sObjectId, location.href]));
    }

  });

});