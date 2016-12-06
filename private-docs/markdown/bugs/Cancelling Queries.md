% Cancelling Queries

A limitation on using the web services is the inability for users to cancel queries dynamically whilst they are loading. This document seeks to investigate the reasons why.

The goal is to cancel queries programmatically in OBIEE using the BI server. The normal method is to login to the presentation services as an Administrator, view the sessions page and view/cancel queries from there. As a normal user, you have the ability to cancel a query while it is loading.

# OBIEE Query Management

In order to analyse the communication between the presentation server and the BI Server, [advanced logging](http://www.rittmanmead.com/2014/11/auditing-obiee-presentation-catalog-activity-with-custom-log-filters/) was configured, specifically accessing the following filters:

* `saw.odbc.connection`
* `saw.odbc.statement.cancel`
* `saw.odbc.statement.close`
* `saw.odbc.statement.execute`
* `saw.odbc.statement.execute.sql`
* `saw.odbc.statement.execute.timings`
* `saw.odbc.statement.fetch`

This then records every call the presentation server makes to the BI Server in the logs.

## Single Analyses

When an analysis is run in OBIEE, whether in Answers or viewing as a report or dashboard, a loading icon appears with a link to cancelling the query beside it. This link fires a HTTP request to the presentation server, specifying a number of query string parameters, of which two are relevant:

* `Action=cancel`
* `SearchID=<GUID>`

The cancel action invokes the process to cancel a query, and the search ID is an apparently randomly generated ID which the presentation server can use to identify the query. The query is identified and the cancel request is made to the BI Server, which translates this into the relevant physical call against the database.

Unlike the query for data, the cancel request made to the BI Server is not exposed as a direct LSQL request, rather is a C++ method (`saw.odbc.statement.cancel`) from (`odbcconnectionimpl.cpp`).

## Session Management

The sessions page, `saw.dll?Sessions`, lists all of the sessions active and requests running, ran or cancelled. Notably, viewing this page does **not** raise an ODBC call at all. The implication of this, is that there is no exposed method to view currently running sessions using the BI server alone, and that this management is handled solely by the presentation server. We know that this cannot be entirely true as the Admin Tool allows for sessions and requests to be viewed, but the mechanism for that must then be different.

Cancelling queries from this screen invoke a different HTTP request to the one with single queries:

* `Action=CancelQuery`
* `ID=<QueryID>`

Here, the query ID is not randomly generated, but instead is the key for the request displayed in the sessions screen. Unfortunately, as this appears to be managed by the presentation server, it is not exposed to any custom applications interfacing with the BI Server. This HTTP request then calls the same ODBC method as before (`saw.odbc.statement.cancel`) when invoked.

## NQS Commands

NQS Commands are the nickname given to logical SQL procedures exposed by the BI server. Some of these are recognisable commands that are used frequently, such as `SAPurgeAllCache()`, but there are many others that allow us to interface with the BI Server in many ways. Calling `NQSGetSQLProcedures('%','%','%')` will return the full list of procedures.

Unfortunately, none of these pertain to either viewing nor cancelling running requests. Sources say that Oracle are in the process of exposing more administration features to this service, but as of version 11.1.1.9, it has not been done for query management.

# Possible Workarounds

## Using the Presentation Server

One of the options to workaround could be to use the presentation server and execute the same HTTP requests against it. Generally, this would be quite a reasonable solution but there are two main reasons why it is quite a poor choice:

* The query ID, required for cancellation, is not returned by the call that invoked it and instead would need to be retrieved from the sessions page. This retrieval would rely on parsing the HTML of this page and would be unreliable between versions and generally inelegant.
* Even if the above was to be implemented, only users with the *Manage Sessions* privilege would be able to return the information. This would mean that unless all users were given the permission, or a dummy user was configured with a hardcoded password, the necessary query ID would not be served.
