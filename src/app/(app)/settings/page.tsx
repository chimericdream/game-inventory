import { Badge } from '@mantine/core';
import Link from 'next/link';

import { longDate } from '@/lib/dates';
import { requireContext } from '@/server/auth/current';
import { recentActivity } from '@/server/data/audit';
import { gameTitles } from '@/server/data/games';
import { listShareLinks } from '@/server/data/guest';
import { listLocationsWithCounts, listMembers } from '@/server/data/lookups';
import { listPlayers } from '@/server/data/players';
import { listTrash, purgeDate, retentionDays } from '@/server/data/trash';

import { describeActivity } from './activity';
import classes from './Settings.module.css';
import { AddLocationForm, AddMemberForm, DeleteLocationButton, PlayerAdmin } from './SettingsForms';
import { ShareLinks } from './ShareLinks';
import { TrashActions } from './TrashList';

export const dynamic = 'force-dynamic';

type Tab = 'people' | 'locations' | 'links' | 'activity' | 'trash';
type SearchParams = Record<string, string | string[] | undefined>;

const TAB_LABELS: Record<Tab, string> = {
  people: 'People',
  locations: 'Locations',
  links: 'Guest links',
  activity: 'Activity',
  trash: 'Trash',
};

const choice = (p: { id: string; displayName: string }) => ({
  value: p.id,
  label: p.displayName,
});

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { ctx } = await requireContext();
  const isAdmin = ctx.viewer.role === 'admin';
  const canEdit = ctx.viewer.role !== 'restricted';
  const tabs: Tab[] = isAdmin
    ? ['people', 'locations', 'links', 'activity', 'trash']
    : canEdit
      ? ['people', 'locations', 'trash']
      : ['people', 'locations'];
  const params = await searchParams;
  const raw = params.tab;
  const asked = Array.isArray(raw) ? raw[0] : raw;
  const tab: Tab = tabs.includes(asked as Tab) ? (asked as Tab) : 'people';

  return (
    <>
      <header className={classes.head}>
        <h1 className={classes.title}>Settings</h1>
      </header>
      <nav className={classes.tabs} aria-label="Settings sections">
        {tabs.map((t) => (
          <Link
            key={t}
            href={t === 'people' ? '/settings' : `/settings?tab=${t}`}
            className={classes.tab}
            aria-current={t === tab ? 'page' : undefined}
          >
            {TAB_LABELS[t]}
          </Link>
        ))}
      </nav>

      {tab === 'people' && <Notice params={params} />}
      {tab === 'people' && <PeopleTab isAdmin={isAdmin} canEdit={canEdit} />}
      {tab === 'locations' && <LocationsTab canEdit={canEdit} />}
      {tab === 'links' && isAdmin && <LinksTab />}
      {tab === 'activity' && isAdmin && <ActivityTab />}
      {tab === 'trash' && canEdit && <TrashTab isAdmin={isAdmin} />}
    </>
  );
}

/** Confirmation after something that removes the person from the list. Fixed sentences only. */
function Notice({ params }: { params: SearchParams }) {
  const done = Array.isArray(params.done) ? params.done[0] : params.done;
  const n = Math.max(0, Number(Array.isArray(params.n) ? params.n[0] : params.n) || 0);
  const text =
    done === 'linked'
      ? `${plural(n, 'play')} now ${n === 1 ? 'counts' : 'count'} for that account.`
      : done === 'merged'
        ? `Merged. ${plural(n, 'play')} moved.`
        : null;
  if (!text) return null;
  return (
    <p className={classes.readOnly} role="status">
      {text}
    </p>
  );
}

async function PeopleTab({ isAdmin, canEdit }: { isAdmin: boolean; canEdit: boolean }) {
  const { ctx } = await requireContext();
  const members = await listMembers(ctx);
  const players = canEdit ? await listPlayers(ctx) : [];
  const guests = players.filter((p) => p.userId === null);

  return (
    <>
      {!canEdit && (
        <p className={classes.readOnly}>
          You can look around here, but only the grown-ups can change things.
        </p>
      )}
      <section className={classes.section} aria-labelledby="people">
        <h2 id="people">People</h2>
        <p className={classes.lede}>
          Everyone who can sign in. Restricted profiles are read-only and never see games marked
          hidden for them.
        </p>
        <ul className={classes.list}>
          {members.map((m) => (
            <li key={m.id} className={classes.person}>
              <span className={classes.avatar} aria-hidden>
                {m.name.slice(0, 1).toUpperCase()}
              </span>
              <span className={classes.personName}>{m.name}</span>
              <Badge variant="light" color={m.role === 'restricted' ? 'berry' : 'forest'}>
                {m.role}
              </Badge>
            </li>
          ))}
        </ul>
        {isAdmin && <AddMemberForm earlierPlayers={guests.map(choice)} />}
      </section>

      {isAdmin && (
        <section className={classes.section} aria-labelledby="guests">
          <h2 id="guests">People who play but have no account</h2>
          <p className={classes.lede}>
            Friends and relatives added while logging a play. If one of them gets an account later,
            link them here and their plays will count for it. If two names are the same person,
            merge them.
          </p>
          {guests.length === 0 ? (
            <p className={classes.empty}>Nobody yet.</p>
          ) : (
            <div className={classes.list}>
              {guests.map((g) => (
                <PlayerAdmin
                  key={g.id}
                  playerId={g.id}
                  name={g.displayName}
                  plays={g.plays}
                  users={members.map((m) => ({ value: m.id, label: m.name }))}
                  others={players.filter((p) => p.id !== g.id).map(choice)}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </>
  );
}

async function LocationsTab({ canEdit }: { canEdit: boolean }) {
  const { ctx } = await requireContext();
  const locations = await listLocationsWithCounts(ctx);
  const byId = new Map(locations.map((l) => [l.id, l]));
  const depth = (id: string): number => {
    let n = 0;
    for (let l = byId.get(id); l?.parentId && n < 10; n++) l = byId.get(l.parentId);
    return n;
  };
  const path = (id: string): string => {
    const names: string[] = [];
    for (let l = byId.get(id), n = 0; l && n < 10; n++) {
      names.unshift(l.name);
      l = l.parentId ? byId.get(l.parentId) : undefined;
    }
    return names.join(' › ');
  };

  return (
    <section className={classes.section} aria-labelledby="locations">
      <h2 id="locations">Locations</h2>
      <p className={classes.lede}>
        Where copies are kept. Put one inside another to make a path such as Hall closet › Shelf 2.
      </p>
      {locations.length === 0 ? (
        <p className={classes.empty}>None yet.</p>
      ) : (
        <ul className={classes.list}>
          {locations.map((l) => (
            <li
              key={l.id}
              className={classes.place}
              data-location
              style={{ marginLeft: depth(l.id) * 24 }}
            >
              <span className={classes.placeName}>{l.parentId ? path(l.id) : l.name}</span>
              <span className={classes.placeCount}>{plural(l.total, 'copy', 'copies')}</span>
              {canEdit && <DeleteLocationButton id={l.id} name={l.name} />}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <AddLocationForm parents={locations.map((l) => ({ value: l.id, label: path(l.id) }))} />
      )}
    </section>
  );
}

async function LinksTab() {
  const { ctx } = await requireContext();
  const links = await listShareLinks(ctx);
  return (
    <section className={classes.section} aria-labelledby="links">
      <h2 id="links">Guest links</h2>
      <p className={classes.lede}>
        Read-only links for visitors. Guests only see games marked “Allow on guest links”.
      </p>
      <ShareLinks
        links={links.map((l) => ({
          id: l.id,
          label: l.label,
          expiresAt: l.expiresAt?.toISOString() ?? null,
          revokedAt: l.revokedAt?.toISOString() ?? null,
          status: l.revokedAt
            ? ('revoked' as const)
            : l.expiresAt && l.expiresAt < new Date()
              ? ('expired' as const)
              : ('active' as const),
          hideTypes: l.hideTypes,
          hideTags: l.hideTags,
          showNotes: l.showNotes,
          showLocations: l.showLocations,
        }))}
      />
    </section>
  );
}

async function ActivityTab() {
  const { ctx } = await requireContext();
  const entries = await recentActivity(ctx, { limit: 60 });
  const ids = entries.flatMap((e) => [
    e.entityType === 'game' ? e.entityId : '',
    typeof e.changes.gameId?.[1] === 'string' ? (e.changes.gameId[1] as string) : '',
    typeof e.changes.gameId?.[0] === 'string' ? (e.changes.gameId[0] as string) : '',
  ]);
  const titles = await gameTitles(ctx, ids);
  return (
    <section className={classes.section} aria-labelledby="activity">
      <h2 id="activity">Activity</h2>
      <p className={classes.lede}>Who changed what, most recent first.</p>
      {entries.length === 0 ? (
        <p className={classes.empty}>Nothing has happened yet.</p>
      ) : (
        <ul className={classes.activity}>
          {entries.map((e) => (
            <li key={e.id} className={classes.event} data-activity>
              <span className={classes.when}>{longDate(e.at.toISOString().slice(0, 10))}</span>
              <span>
                <b>{e.actorName ?? 'Someone who has since left'}</b> {describeActivity(e, titles)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const KIND_LABELS: Record<string, string> = {
  game: 'Game',
  copy: 'Copy',
  play: 'Play',
  wishlist_item: 'Wishlist',
  location: 'Place',
  player: 'Player',
};

async function TrashTab({ isAdmin }: { isAdmin: boolean }) {
  const { ctx } = await requireContext();
  const trashed = await listTrash(ctx);
  const days = retentionDays();
  return (
    <section className={classes.section} aria-labelledby="trash">
      <h2 id="trash">Trash</h2>
      <p className={classes.lede}>
        {isAdmin
          ? 'Everything anyone deletes waits here. Restore it to bring everything back, or delete it forever.'
          : 'Things you deleted wait here. Restore one to bring it back. An admin can delete things for good.'}
        {days > 0
          ? ` Anything left here for ${days} days is deleted for good automatically.`
          : ' Nothing is deleted automatically.'}
      </p>
      {trashed.length === 0 ? (
        <p className={classes.empty}>The trash is empty.</p>
      ) : (
        <ul className={classes.list}>
          {trashed.map((g) => {
            const goesOn = purgeDate(g.deletedAt, days);
            return (
              <li key={`${g.kind}-${g.id}`} className={classes.place} data-trashed={g.kind}>
                <span className={classes.placeName}>
                  {g.title}
                  <span className={classes.trashMeta}>
                    {[
                      KIND_LABELS[g.kind],
                      g.detail && g.detail !== KIND_LABELS[g.kind] ? g.detail : null,
                      `Deleted ${longDate(g.deletedAt.toISOString().slice(0, 10))}${g.deletedByName ? ` by ${g.deletedByName}` : ''}`,
                      goesOn
                        ? `removed for good ${longDate(goesOn.toISOString().slice(0, 10))}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                <TrashActions
                  kind={g.kind}
                  id={g.id}
                  title={g.title}
                  canRestore={g.canRestore}
                  canPurge={isAdmin}
                  plays={g.plays}
                  ratings={g.ratings}
                  expansions={g.expansions}
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
