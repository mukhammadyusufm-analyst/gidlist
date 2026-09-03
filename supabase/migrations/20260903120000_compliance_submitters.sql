-- RUN THIS IN: gidlist-dev
--
-- Who actually filled things in, for the compliance table's column filter.
--
-- The neighbouring `compliance_assignees` answers "who was asked", and the two
-- are deliberately different questions: a checklist assigned to one person and
-- filled in by another is the case the Filled by column exists to show, so a
-- filter driven by the assignee list would be unable to express it.
--
-- NOT `security definer`, matching `compliance_assignees`. Row Level Security
-- therefore applies to the caller, which is the whole point: a plain member
-- sees only their own submissions, so their filter offers only themselves, and
-- an editor's offers the space. Making this definer-rights would have handed
-- every member the full roster of who does what — a disclosure with no
-- corresponding gain, since the rows behind it would still be hidden.
--
-- Nulls are excluded rather than returned as an empty option. "Not filled in"
-- is a real thing to filter for, but it is not a person, and mixing it into a
-- list of email addresses would make the option depend on a blank string
-- surviving a round trip through the URL. The interface offers it as its own
-- choice instead.

create or replace function public.compliance_submitters(
  p_board_id uuid,
  p_from     date,
  p_to       date
)
returns table (email text)
language sql
stable
as $$
  select distinct s.submitted_by_email
    from public.submissions s
    join public.checklists c on c.id = s.checklist_id
   where c.board_id = p_board_id
     and s.due_date between p_from and p_to
     and s.submitted_by_email is not null
   order by 1;
$$;

grant execute on function public.compliance_submitters(uuid, date, date) to authenticated;
