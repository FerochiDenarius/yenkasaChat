-- National Ambulance Management System - APEX low-code dashboard setup
-- Run in SQL Workshop > SQL Commands or SQL Scripts.

create table nams_ambulances (
  ambulance_id number generated always as identity primary key,
  ambulance_code varchar2(20) not null unique,
  status varchar2(30) not null check (status in ('IS_AVAILABLE','IN_TRANSIT','AT_HOSPITAL','MAINTENANCE'))
);

create table nams_emergency_calls (
  call_id number generated always as identity primary key,
  call_code varchar2(20) not null unique,
  caller_name varchar2(100),
  location varchar2(200),
  call_time timestamp default systimestamp not null
);

create table nams_patients (
  patient_id number generated always as identity primary key,
  full_name varchar2(120) not null,
  created_at timestamp default systimestamp not null
);

create table nams_staff (
  staff_id number generated always as identity primary key,
  full_name varchar2(120) not null,
  role_name varchar2(60) not null
);

create table nams_dispatches (
  dispatch_id number generated always as identity primary key,
  dispatch_code varchar2(20) not null unique,
  call_id number references nams_emergency_calls(call_id),
  ambulance_id number references nams_ambulances(ambulance_id),
  status varchar2(30) not null check (status in ('PENDING','ASSIGNED','IN_PROGRESS','COMPLETED')),
  dispatch_time timestamp default systimestamp not null
);

create table nams_alerts (
  alert_id number generated always as identity primary key,
  alert_type varchar2(20) not null,
  message varchar2(300) not null,
  alert_time timestamp default systimestamp not null
);

insert into nams_ambulances (ambulance_code,status)
select 'A-' || to_char(level,'FM000'),
       case
         when level <= 18 then 'IS_AVAILABLE'
         when level <= 38 then 'IN_TRANSIT'
         when level <= 46 then 'AT_HOSPITAL'
         else 'MAINTENANCE'
       end
from dual connect by level <= 50;

insert into nams_staff (full_name,role_name)
select 'Staff Member ' || level,
       case when mod(level,4)=0 then 'Dispatcher' when mod(level,4)=1 then 'Paramedic' when mod(level,4)=2 then 'Driver' else 'Admin' end
from dual connect by level <= 80;

insert into nams_patients (full_name)
select 'Patient ' || level from dual connect by level <= 25;

insert into nams_emergency_calls (call_code,caller_name,location,call_time)
select 'C-' || to_char(level,'FM00000'), 'Caller ' || level, 'Greater Accra Region', systimestamp - numtodsinterval(level * 12, 'minute')
from dual connect by level <= 40;

insert into nams_dispatches (dispatch_code,call_id,ambulance_id,status,dispatch_time)
select 'D-' || to_char(level,'FM00000'),
       level,
       mod(level,50) + 1,
       case when level <= 5 then 'PENDING' when level <= 15 then 'ASSIGNED' when level <= 22 then 'IN_PROGRESS' else 'COMPLETED' end,
       systimestamp - numtodsinterval(level * 20, 'minute')
from dual connect by level <= 45;

insert into nams_alerts (alert_type,message,alert_time) values ('DANGER','Ambulance A-103 is under maintenance.',systimestamp - interval '1' hour);
insert into nams_alerts (alert_type,message,alert_time) values ('WARNING','High number of emergency calls in Greater Accra Region.',systimestamp - interval '75' minute);
insert into nams_alerts (alert_type,message,alert_time) values ('INFO','Shift change at 02:00 PM today.',systimestamp - interval '90' minute);

create or replace view nams_dashboard_kpis as
select 1 sort_order, 'Total Emergency Calls' title, count(*) value, 'All time' subtitle, 'fa-phone' icon_css, 'u-color-5' card_color from nams_emergency_calls
union all select 2, 'Total Ambulances', count(*), 'All time', 'fa-ambulance', 'u-color-4' from nams_ambulances
union all select 3, 'Available Ambulances', count(*), 'Ready to respond', 'fa-check-circle', 'u-color-7' from nams_ambulances where status = 'IS_AVAILABLE'
union all select 4, 'Total Staff', count(*), 'All staff', 'fa-users', 'u-color-13' from nams_staff
union all select 5, 'Total Patients', count(*), 'All time', 'fa-user', 'u-color-9' from nams_patients
union all select 6, 'Total Dispatches', count(*), 'All time', 'fa-paper-plane', 'u-color-12' from nams_dispatches
union all select 7, 'Dispatches In Progress', count(*), 'Active now', 'fa-heartbeat', 'u-color-8' from nams_dispatches where status = 'IN_PROGRESS'
union all select 8, 'Dispatches Completed', count(*), 'Today', 'fa-clock-o', 'u-color-15' from nams_dispatches where status = 'COMPLETED';

create or replace view nams_ambulance_status_chart as
select status label, count(*) value from nams_ambulances group by status;

create or replace view nams_dispatch_status_chart as
select status label, count(*) value from nams_dispatches group by status;

create or replace view nams_recent_dispatches as
select d.dispatch_code,
       c.call_code,
       a.ambulance_code,
       d.status,
       to_char(d.dispatch_time, 'DD Mon YYYY HH:MI AM') dispatch_time
from nams_dispatches d
join nams_emergency_calls c on c.call_id = d.call_id
join nams_ambulances a on a.ambulance_id = d.ambulance_id
order by d.dispatch_time desc;

commit;
