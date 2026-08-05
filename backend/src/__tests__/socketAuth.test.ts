/**
 * SEC-05: socket rooms had no authorization at all. `join-event` and
 * `join-report` joined whatever id the client sent, so any authenticated user
 * could read — and post into — chats on group-scoped events and reports they
 * were not a member of.
 *
 * These tests drive the handlers directly with a fake socket rather than
 * standing up a real Socket.IO server, which keeps them fast and focused on the
 * authorization decision.
 */

const mockFrom = jest.fn();
const mockIsMember = jest.fn();
const mockSaveEventMessage = jest.fn();
const mockSaveReportMessage = jest.fn();

jest.mock('../config/supabase', () => ({
  supabaseAdmin: { from: (...args: unknown[]) => mockFrom(...args) },
  supabaseAuthClient: { auth: {} },
}));

jest.mock('../services/group.service', () => ({
  __esModule: true,
  default: { isMember: (...args: unknown[]) => mockIsMember(...args) },
}));

jest.mock('../services/chat.service', () => ({
  __esModule: true,
  default: { saveMessage: (...args: unknown[]) => mockSaveEventMessage(...args) },
}));

jest.mock('../services/reportChat.service', () => ({
  __esModule: true,
  default: { saveMessage: (...args: unknown[]) => mockSaveReportMessage(...args) },
}));

jest.mock('../middleware/auth', () => ({ verifyAccessToken: jest.fn() }));

jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { Server } from 'socket.io';
import socketService from '../services/socket.service';

/** Row lookup used by canAccess(). */
function eventOwnedByGroup(groupId: string | null) {
  const builder: Record<string, unknown> = {};
  builder.select = jest.fn(() => builder);
  builder.eq = jest.fn(() => builder);
  builder.single = jest.fn().mockResolvedValue({ data: { group_id: groupId }, error: null });
  return builder;
}

interface FakeSocket {
  userId?: string;
  handlers: Map<string, (...args: any[]) => any>;
  joined: string[];
  emitted: { event: string; payload: unknown }[];
  on: (event: string, handler: (...args: any[]) => any) => void;
  join: (room: string) => void;
  leave: (room: string) => void;
  emit: (event: string, payload: unknown) => void;
  to: () => { emit: jest.Mock };
}

function makeSocket(userId = 'user-1'): FakeSocket {
  const socket: FakeSocket = {
    userId,
    handlers: new Map(),
    joined: [],
    emitted: [],
    on(event, handler) {
      this.handlers.set(event, handler);
    },
    join(room) {
      this.joined.push(room);
    },
    leave() {},
    emit(event, payload) {
      this.emitted.push({ event, payload });
    },
    to: () => ({ emit: jest.fn() }),
  };
  return socket;
}

/** Register the connection handlers against a fake socket and return it. */
function connect(userId?: string): FakeSocket {
  const socket = makeSocket(userId);
  const io = {
    use: jest.fn(),
    on: jest.fn((event: string, handler: (s: unknown) => void) => {
      if (event === 'connection') handler(socket);
    }),
    to: jest.fn(() => ({ emit: jest.fn() })),
  } as unknown as Server;

  socketService.initialize(io);
  return socket;
}

describe('event room authorization', () => {
  beforeEach(() => {
    mockFrom.mockReset();
    mockIsMember.mockReset();
    mockSaveEventMessage.mockReset();
  });

  it('allows joining a public event', async () => {
    mockFrom.mockReturnValue(eventOwnedByGroup(null));
    const socket = connect();

    await socket.handlers.get('join-event')!('event-1');

    expect(socket.joined).toContain('event:event-1');
  });

  it('allows a group member to join a group-scoped event', async () => {
    mockFrom.mockReturnValue(eventOwnedByGroup('group-9'));
    mockIsMember.mockResolvedValue(true);
    const socket = connect();

    await socket.handlers.get('join-event')!('event-1');

    expect(mockIsMember).toHaveBeenCalledWith('group-9', 'user-1');
    expect(socket.joined).toContain('event:event-1');
  });

  it('refuses a non-member joining a group-scoped event (SEC-05)', async () => {
    mockFrom.mockReturnValue(eventOwnedByGroup('group-9'));
    mockIsMember.mockResolvedValue(false);
    const socket = connect();

    await socket.handlers.get('join-event')!('event-1');

    expect(socket.joined).toEqual([]);
    expect(socket.emitted.some((e) => e.event === 'error')).toBe(true);
  });

  it('refuses posting to a room the user could not join', async () => {
    // Checked independently of join: a client can emit send-message without
    // ever having joined the room.
    mockFrom.mockReturnValue(eventOwnedByGroup('group-9'));
    mockIsMember.mockResolvedValue(false);
    const socket = connect();

    await socket.handlers.get('send-message')!({ eventId: 'event-1', text: 'hello' });

    expect(mockSaveEventMessage).not.toHaveBeenCalled();
  });

  it('rejects an empty message', async () => {
    mockFrom.mockReturnValue(eventOwnedByGroup(null));
    const socket = connect();

    await socket.handlers.get('send-message')!({ eventId: 'event-1', text: '   ' });

    expect(mockSaveEventMessage).not.toHaveBeenCalled();
  });

  it('rejects an over-long message', async () => {
    mockFrom.mockReturnValue(eventOwnedByGroup(null));
    const socket = connect();

    await socket.handlers.get('send-message')!({
      eventId: 'event-1',
      text: 'x'.repeat(1001),
    });

    expect(mockSaveEventMessage).not.toHaveBeenCalled();
  });

  it('trims the message before saving', async () => {
    mockFrom.mockReturnValue(eventOwnedByGroup(null));
    mockSaveEventMessage.mockResolvedValue({ id: 'm1' });
    const socket = connect();

    await socket.handlers.get('send-message')!({ eventId: 'event-1', text: '  hi  ' });

    expect(mockSaveEventMessage).toHaveBeenCalledWith('event-1', 'user-1', 'hi', false);
  });
});

describe('report room authorization', () => {
  beforeEach(() => {
    mockFrom.mockReset();
    mockIsMember.mockReset();
    mockSaveReportMessage.mockReset();
  });

  it('refuses a non-member joining a group-scoped report', async () => {
    mockFrom.mockReturnValue(eventOwnedByGroup('group-9'));
    mockIsMember.mockResolvedValue(false);
    const socket = connect();

    await socket.handlers.get('join-report')!('report-1');

    expect(socket.joined).toEqual([]);
  });

  it('refuses posting into a report chat the user cannot access', async () => {
    mockFrom.mockReturnValue(eventOwnedByGroup('group-9'));
    mockIsMember.mockResolvedValue(false);
    const socket = connect();

    await socket.handlers.get('send-report-message')!({
      reportId: 'report-1',
      text: 'hello',
    });

    expect(mockSaveReportMessage).not.toHaveBeenCalled();
  });

  it('refuses a missing report', async () => {
    const builder: Record<string, unknown> = {};
    builder.select = jest.fn(() => builder);
    builder.eq = jest.fn(() => builder);
    builder.single = jest.fn().mockResolvedValue({ data: null, error: { message: 'no rows' } });
    mockFrom.mockReturnValue(builder);
    const socket = connect();

    await socket.handlers.get('join-report')!('does-not-exist');

    expect(socket.joined).toEqual([]);
  });
});
