---
Type:     text/vnd.ase.task
Id:       webshop
Created:  2026-01-01 10:00
Modified: 2026-01-01 10:00
Status:   OPEN
Kind:     CRAFTING
---

#   TASK: Webshop Improvements for the Spring Release

##  SPECIFICATION (WHAT)

-   [ ] DOM: **Product Search**: It is very important that customers are
    able to actually find products in the catalog in a fast way, which
    means that there needs to be a full-text search over the product
    name and the product description, and it should basically also be
    possible to filter the search results by category and by a price
    range, and of course the results should be paginated with 20 items
    per page, as is the case on most other shops as well.

-   [ ] DOM: **Search Ranking**: When the search results are shown, the
    products whose name matches the search term should in general be
    shown before the products where only the description matches, and
    products that are out of stock should be shown at the very end of
    the result list, so that customers do not get frustrated.

-   [ ] DOM: **Guest Checkout**: In order to increase the conversion
    rate, it should be possible for customers to check out as a guest
    without having to create an account first, where only the e-mail
    address, the shipping address, and the payment data have to be
    entered, and the guest should then get an order confirmation by
    e-mail as it is the case for registered customers as well.

-   [ ] DOM: **Checkout Validation**: All the input fields of the
    checkout form need to be validated on the server side, which means
    that the e-mail address must be a syntactically valid address, the
    postal code must match the format of the selected country, and the
    quantity of every order line must be a positive integer number.

-   [ ] DOM: **Sales Report**: The shop administrators would really like
    to have a report that shows them the revenue per day and per product
    category for a freely selectable date range, and this report should
    be exportable as a CSV file so that it can be imported into the
    spreadsheet tool of the controlling department.

-   [ ] DOM: **Low-Stock Alert**: Additionally, the administrators want to
    receive an e-mail once per day that lists all the products whose
    stock has fallen below a configurable threshold, so that they can
    reorder them in time before they are completely sold out.

##  DESIGN (HOW)

-   [ ] ARC: **Search Index**: For the full-text search, the existing
    PostgreSQL database should be used with its built-in full-text
    search capabilities (a `tsvector` column with a GIN index), instead
    of introducing a separate search engine like Elasticsearch, because
    this keeps the operations effort low.

-   [ ] ARC: **Checkout Service**: The guest checkout should reuse the
    existing order service, where a guest order is simply an order
    without a customer id but with an e-mail address stored directly on
    the order.

-   [ ] ARC: **Reporting Job**: The sales report and the low-stock alert
    should both be implemented as part of a reporting module, where the
    low-stock alert runs as a scheduled job once per day at 06:00.

##  VERIFICATION (CHECK)

-   [ ] TST: **Search Tests**: There should be tests for the search that
    check the ranking, the filters, and the pagination.

-   [ ] TST: **Checkout Tests**: There should be tests for the guest
    checkout including all the validation rules.

-   [ ] TST: **Report Tests**: There should be tests for the report
    computation and for the CSV export, as well as for the low-stock
    threshold logic.
