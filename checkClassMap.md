# Notes on checkClassMap utility

checkClassMap.js is a quick and dirty pre-flight utility to check that all the class codes in the FEP-title-to-QB-class-map.js file used by RevenueConversion.js are correct.

The problem solved is that occasionally class codes get edited and changed in QuickBooks but not in FEP-title-to-QB-class-map.js. Later, when revenue conversion is run, the old class code is associated with a title in a revenue report and gets re-imported into QB by Transaction Pro Importer when the revenue data is imported.

checkClassMap will examine all the class codes in the map file and check that they are also present in a list of current class codes freshly exported from Quickbooks.

So, prior to running checkClassMap, an updated list of current class codes needs to be prepared and placed into the appropriate shared data folder: .../FinancialData/FEP/RevenueReports.

To export the class list from QuickBooks, follow these steps:

* Log in to Quickbooks FEP account
* Click on 'Reports | All Reports | Class List
* Once the report show up on screen, click on the export icon in the upper-right and select 'Export to Excel'
* Save the Excel file to .../FinancialData/FEP/RevenueReports and open it with Excel
* delete the header and footer rows from the excel file
* Save the spreadsheet as a .csv file
* Open the .csv file in a text editor, remove the quote characters around any lines that have them
* Save the edited file as FEP-current-class-list.txt into .../FinancialData/FEP/RevenueReports
* Finally run `node checkClassMap --company FEP`

It will report any class codes found in the map file that are not present in the class list
