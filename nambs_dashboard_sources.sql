-- National Ambulance Management System (NAMBS)
-- Dashboard SQL sources for Oracle APEX native components.
-- Run this in APEX: SQL Workshop > SQL Scripts > Upload/Run
-- or SQL Workshop > SQL Commands.

create or replace view nambs_dashboard_cards as
select 1 display_order,
       'Total Emergency Calls' card_title,
       to_char(count(*)) card_value,
       'All time' card_subtitle,
       'fa-phone' icon_css
from emergency_call
union all
select 2 display_order,
       'Total Ambulances' card_title,
       to_char(count(*)) card_value,
       'All time' card_subtitle,
       'fa-ambulance' icon_css
from ambulance
union all
select 3 display_order,
       'Available Ambulances' card_title,
       to_char(count(*)) card_value,
       'Ready to respond' card_subtitle,
       'fa-check-circle' icon_css
from ambulance
where upper(ambulance_status) in ('AVAILABLE', 'IS_AVAILABLE')
union all
select 4 display_order,
       'Total Staff' card_title,
       to_char(count(*)) card_value,
       'All staff' card_subtitle,
       'fa-users' icon_css
from staff
union all
select 5 display_order,
       'Total Patients' card_title,
       to_char(count(*)) card_value,
       'All time' card_subtitle,
       'fa-user' icon_css
from patient
union all
select 6 display_order,
       'Total Dispatches' card_title,
       to_char(count(*)) card_value,
       'All time' card_subtitle,
       'fa-paper-plane' icon_css
from dispatch;

create or replace view nambs_ambulance_status_overview as
select ambulance_status,
       count(*) total
from ambulance
group by ambulance_status;

create or replace view nambs_dispatch_status_overview as
select status,
       count(*) total
from dispatch
group by status;

create or replace view nambs_recent_dispatches as
select dispatch_id,
       call_id,
       ambulance_id,
       status
from dispatch;

create or replace view nambs_dashboard_totals as
select (select count(*) from emergency_call) total_emergency_calls,
       (select count(*) from ambulance) total_ambulances,
       (select count(*) from ambulance where upper(ambulance_status) in ('AVAILABLE', 'IS_AVAILABLE')) available_ambulances,
       (select count(*) from staff) total_staff,
       (select count(*) from patient) total_patients,
       (select count(*) from dispatch) total_dispatches
from dual;
