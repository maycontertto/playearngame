import { createContext, createElement, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

export type TaskType = 'ad' | 'link' | 'interact' | 'mission';
export type GameType = 'roulette' | 'quickclick' | 'memory';
export type AppMode = 'local' | 'connecting' | 'supabase';

export interface UserProfile {
	name: string;
	avatar: string;
	hasCompletedOnboarding: boolean;
	level: number;
	xp: number;
	xpToNext: number;
	points: number;
	withdrawablePoints: number;
	pendingWithdrawablePoints: number;
	totalWithdrawnPoints: number;
	referralEarningsCents: number;
	pendingReferralEarningsCents: number;
	availableReferralEarningsCents: number;
	balance: number;
	streak: number;
	tasksCompleted: number;
	gamesPlayed: number;
	referralCode: string;
	referralCount: number;
	referredByCode: string | null;
	riskScore: number;
	riskLevel: 'low' | 'medium' | 'high';
	withdrawalBlocked: boolean;
	dailyBonusClaimed: boolean;
	dailyTasksCompleted: number;
	dailyAdViews: number;
	dailyGamesPlayed: number;
	rouletteSpinsLeft: number;
	qualifiedRevenueCents: number;
	userShareCents: number;
	operatorShareCents: number;
	reserveShareCents: number;
	lastLoginDate: string;
}

function createDisplayNameFromEmail(email: string) {
	const localPart = email.split('@')[0]?.trim() || 'Jogador';
	const cleaned = localPart.replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim();
	if (!cleaned) return 'Jogador';
	return cleaned
		.split(' ')
		.map(part => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');
}

export interface TaskItem {
	id: string;
	title: string;
	description: string;
	points: number;
	type: TaskType;
	icon: string;
	completed: boolean;
	estimatedRevenueCents?: number;
}

export type WithdrawalStatus = 'pending' | 'approved' | 'paid';

export interface WithdrawalRecord {
	id: string;
	amount: number;
	points: number;
	status: WithdrawalStatus;
	date: string;
}

export type RevenueEventStatus = 'pending' | 'available' | 'locked' | 'withdrawn';
export type RevenueEventKind = 'task' | 'referral';

export interface ReferralLeaderboardEntry {
	id: string;
	name: string;
	avatar: string;
	referralCount: number;
	totalReferralEarningsCents: number;
	availableReferralEarningsCents: number;
	riskLevel: 'low' | 'medium' | 'high';
}

export interface RevenueEvent {
	id: string;
	eventKind: RevenueEventKind;
	originUserId?: string;
	sourceId?: string;
	sourceType: TaskType;
	title: string;
	qualifiedRevenueCents: number;
	userShareCents: number;
	operatorShareCents: number;
	reserveShareCents: number;
	status: RevenueEventStatus;
	createdAt: string;
	availableAt: string;
	payoutModelVersion: string;
}

export interface LeaderboardEntry {
	id: string;
	name: string;
	points: number;
	avatar: string;
}

export interface MissionItem {
	id: string;
	label: string;
	description: string;
	target: number;
	progress: number;
	reward: number;
	completed: boolean;
}

export interface EconomySnapshot {
	qualifiedRevenueCents: number;
	userShareCents: number;
	pendingUserShareCents: number;
	availableUserShareCents: number;
	siteShareCents: number;
	operatorShareCents: number;
	reserveShareCents: number;
	userSharePct: number;
	directReferralPct: number;
	indirectReferralPct: number;
	siteSharePct: number;
	operatorSharePct: number;
	reserveSharePct: number;
	settlementDays: number;
	recommendedModel: string;
	modeLabel: string;
}

export interface WithdrawalResult {
	ok: boolean;
	message: string;
}

export type AdminRole = 'owner' | 'admin' | 'finance' | 'support';
export type AdminWithdrawalAction = 'approve' | 'pay' | 'reject';

export interface AdminWithdrawalItem {
	id: string;
	userId: string;
	userName: string;
	userAvatar: string;
	pixKey: string;
	amountBrl: number;
	pointsUsed: number;
	status: 'pending' | 'approved' | 'paid' | 'rejected';
	createdAt: string;
	processedAt: string | null;
	adminNote: string | null;
	lockedRevenuePoints: number;
	lockedEventsCount: number;
	riskScore: number;
	riskLevel: 'low' | 'medium' | 'high';
	fraudHold: boolean;
}

interface PersistedState {
	version: number;
	deviceId: string;
	profile: UserProfile;
	tasks: TaskItem[];
	withdrawals: WithdrawalRecord[];
	revenueEvents: RevenueEvent[];
}

interface CompleteTaskOptions {
	taskId?: string;
	taskType?: TaskType;
	title?: string;
	estimatedRevenueCents?: number;
}

interface GameContextValue {
	profile: UserProfile;
	tasks: TaskItem[];
	withdrawals: WithdrawalRecord[];
	revenueEvents: RevenueEvent[];
	sessionUserId: string | null;
	sessionEmail: string | null;
	isAuthenticated: boolean;
	isAdmin: boolean;
	adminRole: AdminRole | null;
	adminWithdrawals: AdminWithdrawalItem[];
	referralLeaderboard: ReferralLeaderboardEntry[];
	leaderboard: LeaderboardEntry[];
	missions: MissionItem[];
	economy: EconomySnapshot;
	mode: AppMode;
	signInWithEmail: (email: string, password: string) => Promise<WithdrawalResult>;
	signUpWithEmail: (email: string, password: string, avatar: string, referralCode?: string) => Promise<WithdrawalResult>;
	signOut: () => Promise<void>;
	updateProfile: (updates: Partial<UserProfile>) => void;
	completeOnboarding: (name: string, avatar: string) => Promise<void>;
	addPoints: (amount: number, xpAmount?: number) => void;
	completeTask: (points: number, options?: CompleteTaskOptions) => Promise<void>;
	claimDailyBonus: () => number;
	useRouletteSpin: () => boolean;
	incrementGamesPlayed: () => void;
	requestWithdrawal: (pixKey: string) => Promise<WithdrawalResult>;
	applyReferralCode: (referralCode: string) => Promise<WithdrawalResult>;
	refreshAdminWithdrawals: () => Promise<void>;
	reviewWithdrawalRequest: (requestId: string, action: AdminWithdrawalAction, adminNote?: string) => Promise<WithdrawalResult>;
}

type RemoteProfileRow = {
	id: string;
	display_name: string | null;
	avatar: string | null;
	level: number | null;
	xp: number | null;
	xp_to_next: number | null;
	points: number | null;
	withdrawable_points: number | null;
	pending_withdrawable_points: number | null;
	total_withdrawn_points: number | null;
	referral_earnings_cents: number | null;
	pending_referral_earnings_cents: number | null;
	available_referral_earnings_cents: number | null;
	balance: number | null;
	risk_score: number | null;
	risk_level: 'low' | 'medium' | 'high' | null;
	withdrawal_blocked: boolean | null;
	streak: number | null;
	tasks_completed: number | null;
	games_played: number | null;
	referral_code: string | null;
	referral_count: number | null;
	referred_by_code: string | null;
	daily_bonus_claimed: boolean | null;
	daily_tasks_completed: number | null;
	daily_ad_views: number | null;
	daily_games_played: number | null;
	roulette_spins_left: number | null;
	qualified_revenue_cents: number | null;
	user_share_cents: number | null;
	operator_share_cents: number | null;
	reserve_share_cents: number | null;
	last_login_date: string | null;
};

const STORAGE_KEY = 'taskplay_state_v2';
const LEGACY_PROFILE_KEY = 'taskplay_profile';
export const POINTS_PER_REAL = 100;
export const MIN_WITHDRAW_POINTS = 1000;
export const REVENUE_SETTLEMENT_DAYS = 7;
export const MAX_PENDING_WITHDRAWALS = 1;
export const MAX_DAILY_WITHDRAWALS = 1;
export const DIRECT_REFERRAL_PCT = 3;
export const INDIRECT_REFERRAL_PCT = 1;
const DEFAULT_DAILY_ROULETTE_SPINS = 3;
const BASE_USER_SHARE_PCT = 80;
const SITE_SHARE_PCT = 20;
const OPERATION_SHARE_WITHIN_SITE_PCT = 60;
const RESERVE_SHARE_WITHIN_SITE_PCT = 40;

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
const supabase = isSupabaseConfigured
	? createClient(supabaseUrl, supabaseAnonKey, {
			auth: {
				persistSession: true,
				autoRefreshToken: true,
				detectSessionInUrl: true,
			},
		})
	: null;

const GameContext = createContext<GameContextValue | undefined>(undefined);

function toDateOnly(date = new Date()) {
	return date.toISOString().split('T')[0];
}

function createReferralCode() {
	return 'TASK' + Math.random().toString(36).substring(2, 8).toUpperCase();
}

function createDeviceId() {
	if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
		return crypto.randomUUID();
	}

	return `device-${Math.random().toString(36).slice(2, 12)}`;
}

export function pointsToBrl(points: number) {
	return (points / POINTS_PER_REAL).toFixed(2);
}

export function centsToBrl(cents: number) {
	return (cents / 100).toFixed(2);
}

function calculateXpProgress(profile: UserProfile, amount: number, xpAmount?: number) {
	let newXp = profile.xp + (xpAmount ?? Math.max(1, Math.floor(amount / 2)));
	let newLevel = profile.level;
	let newXpToNext = profile.xpToNext;

	while (newXp >= newXpToNext) {
		newXp -= newXpToNext;
		newLevel += 1;
		newXpToNext = Math.floor(newXpToNext * 1.4);
	}

	return {
		xp: newXp,
		level: newLevel,
		xpToNext: newXpToNext,
	};
}

function calculateRevenueDistribution(qualifiedRevenueCents: number) {
	const userSharePct = BASE_USER_SHARE_PCT;
	const directReferralPct = DIRECT_REFERRAL_PCT;
	const indirectReferralPct = INDIRECT_REFERRAL_PCT;
	const siteSharePct = SITE_SHARE_PCT - directReferralPct - indirectReferralPct;
	const userShareCents = Math.round((qualifiedRevenueCents * userSharePct) / 100);
	const siteShareCents = Math.max(0, qualifiedRevenueCents - userShareCents);
	const operatorShareCents = Math.round((siteShareCents * OPERATION_SHARE_WITHIN_SITE_PCT) / 100);
	const reserveShareCents = Math.max(0, siteShareCents - operatorShareCents);
	const operatorSharePct = Math.round(siteSharePct * (OPERATION_SHARE_WITHIN_SITE_PCT / 100));
	const reserveSharePct = Math.round(siteSharePct * (RESERVE_SHARE_WITHIN_SITE_PCT / 100));

	return {
		qualifiedRevenueCents,
		userShareCents,
		siteShareCents,
		operatorShareCents,
		reserveShareCents,
		userSharePct,
		directReferralPct: DIRECT_REFERRAL_PCT,
		indirectReferralPct: INDIRECT_REFERRAL_PCT,
		siteSharePct,
		operatorSharePct,
		reserveSharePct,
	};
}

function createDefaultProfile(): UserProfile {
	return {
		name: 'Jogador',
		avatar: '🎮',
		hasCompletedOnboarding: false,
		level: 1,
		xp: 0,
		xpToNext: 100,
		points: 250,
		withdrawablePoints: 0,
		pendingWithdrawablePoints: 0,
		totalWithdrawnPoints: 0,
		referralEarningsCents: 0,
		pendingReferralEarningsCents: 0,
		availableReferralEarningsCents: 0,
		balance: 0,
		streak: 1,
		tasksCompleted: 0,
		gamesPlayed: 0,
		referralCode: createReferralCode(),
		referralCount: 0,
		referredByCode: null,
		riskScore: 0,
		riskLevel: 'low',
		withdrawalBlocked: false,
		dailyBonusClaimed: false,
		dailyTasksCompleted: 0,
		dailyAdViews: 0,
		dailyGamesPlayed: 0,
		rouletteSpinsLeft: DEFAULT_DAILY_ROULETTE_SPINS,
		qualifiedRevenueCents: 0,
		userShareCents: 0,
		operatorShareCents: 0,
		reserveShareCents: 0,
		lastLoginDate: toDateOnly(),
	};
}

function createInitialTasks(): TaskItem[] {
	return [
		{
			id: '1',
			title: 'Assistir anúncio qualificado',
			description: 'Vídeo curto com receita rastreada e payout variável.',
			points: 18,
			type: 'ad',
			icon: '📺',
			completed: false,
			estimatedRevenueCents: 30,
		},
		{
			id: '2',
			title: 'Visitar página do parceiro',
			description: 'Acesse a landing page do parceiro e mantenha engajamento real.',
			points: 10,
			type: 'link',
			icon: '🔗',
			completed: false,
			estimatedRevenueCents: 16,
		},
		{
			id: '3',
			title: 'Assistir anúncio premium',
			description: 'Formato com remuneração maior para inventário premium.',
			points: 24,
			type: 'ad',
			icon: '🎬',
			completed: false,
			estimatedRevenueCents: 40,
		},
		{
			id: '4',
			title: 'Interagir com conteúdo',
			description: 'Concluir a missão do patrocinador com permanência mínima.',
			points: 20,
			type: 'interact',
			icon: '💬',
			completed: false,
			estimatedRevenueCents: 32,
		},
		{
			id: '5',
			title: 'Clicar no link validado',
			description: 'Clique com verificação básica anti-fraude e permanência.',
			points: 8,
			type: 'link',
			icon: '👆',
			completed: false,
			estimatedRevenueCents: 12,
		},
		{
			id: '6',
			title: 'Missão patrocinada',
			description: 'Tutorial ou fluxo patrocinado com maior valor por conclusão.',
			points: 30,
			type: 'ad',
			icon: '📖',
			completed: false,
			estimatedRevenueCents: 50,
		},
	];
}

function createInitialWithdrawals(): WithdrawalRecord[] {
	return [
		{ id: 'w1', amount: 15, points: 1500, status: 'paid', date: '2026-03-12' },
		{ id: 'w2', amount: 10, points: 1000, status: 'approved', date: '2026-03-18' },
	];
}

function createInitialLeaderboard(): LeaderboardEntry[] {
	return [
		{ id: 'l1', name: 'Maria S.', points: 12450, avatar: '🦊' },
		{ id: 'l2', name: 'Carlos R.', points: 9820, avatar: '🐱' },
		{ id: 'l3', name: 'Ana L.', points: 7340, avatar: '🦄' },
		{ id: 'l4', name: 'Pedro M.', points: 5100, avatar: '🐼' },
		{ id: 'l5', name: 'Julia F.', points: 3200, avatar: '🐸' },
	];
}

function createBaseState(deviceId = createDeviceId()): PersistedState {
	return {
		version: 3,
		deviceId,
		profile: createDefaultProfile(),
		tasks: createInitialTasks(),
		withdrawals: createInitialWithdrawals(),
		revenueEvents: [],
	};
}

function normalizeProfile(profile?: Partial<UserProfile>): UserProfile {
	const baseProfile = createDefaultProfile();
	const hasCompletedOnboarding =
		typeof profile?.hasCompletedOnboarding === 'boolean'
			? profile.hasCompletedOnboarding
			: Boolean(
				(profile?.name && profile.name !== baseProfile.name) ||
				(profile?.tasksCompleted ?? 0) > 0 ||
				(profile?.gamesPlayed ?? 0) > 0 ||
				profile?.referredByCode,
			);

	return {
		...baseProfile,
		...profile,
		hasCompletedOnboarding,
	};
}

function normalizeRevenueEvents(events?: RevenueEvent[]) {
	return events?.length ? events : [];
}

function createRevenueEventId() {
	if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
		return crypto.randomUUID();
	}

	return `rev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function addDaysIso(days: number, base = new Date()) {
	const next = new Date(base);
	next.setDate(next.getDate() + days);
	return next.toISOString();
}

function calculatePendingWithdrawablePoints(events: RevenueEvent[]) {
	return events
		.filter(event => event.status === 'pending')
		.reduce((total, event) => total + event.userShareCents, 0);
}

function settleRevenueState(state: PersistedState) {
	let releasedPoints = 0;

	const revenueEvents = normalizeRevenueEvents(state.revenueEvents).map(event => {
		if (event.status !== 'pending') {
			return event;
		}

		if (new Date(event.availableAt).getTime() > Date.now()) {
			return event;
		}

		releasedPoints += event.userShareCents;
		return {
			...event,
			status: 'available' as const,
		};
	});

	const pendingWithdrawablePoints = calculatePendingWithdrawablePoints(revenueEvents);
	const currentProfile = normalizeProfile(state.profile);
	const nextProfile = {
		...currentProfile,
		withdrawablePoints: currentProfile.withdrawablePoints + releasedPoints,
		pendingWithdrawablePoints,
		balance: Number(pointsToBrl(currentProfile.withdrawablePoints + releasedPoints)),
	};

	return {
		...state,
		profile: nextProfile,
		revenueEvents,
	};
}

function isPixKeyValid(pixKey: string) {
	const value = pixKey.trim();
	if (!value) return false;

	const cleanedDigits = value.replace(/\D/g, '');
	const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
	const isPhone = /^\+?\d{10,13}$/.test(cleanedDigits);
	const isCpf = /^\d{11}$/.test(cleanedDigits);
	const isCnpj = /^\d{14}$/.test(cleanedDigits);
	const isRandomKey = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

	return isEmail || isPhone || isCpf || isCnpj || isRandomKey;
}

function consumeAvailableRevenueEvents(events: RevenueEvent[], pointsToConsume: number) {
	let remaining = pointsToConsume;

	return events.map(event => {
		if (remaining <= 0 || event.status !== 'available') {
			return event;
		}

		remaining -= event.userShareCents;
		return {
			...event,
			status: 'withdrawn' as const,
		};
	});
}

function normalizeTasks(tasks?: TaskItem[]) {
	if (!tasks?.length) {
		return createInitialTasks();
	}

	return createInitialTasks().map(task => ({
		...task,
		...tasks.find(current => current.id === task.id),
	}));
}

function diffInDays(previousDate: string, currentDate: string) {
	const previous = new Date(`${previousDate}T00:00:00`);
	const current = new Date(`${currentDate}T00:00:00`);
	const difference = current.getTime() - previous.getTime();
	return Math.round(difference / (1000 * 60 * 60 * 24));
}

function resetDailyState(state: PersistedState): PersistedState {
	const today = toDateOnly();
	const profile = normalizeProfile(state.profile);

	if (profile.lastLoginDate === today) {
		return {
			...state,
			profile,
			tasks: normalizeTasks(state.tasks),
		};
	}

	const gap = diffInDays(profile.lastLoginDate, today);
	const nextProfile: UserProfile = {
		...profile,
		dailyBonusClaimed: false,
		dailyTasksCompleted: 0,
		dailyAdViews: 0,
		dailyGamesPlayed: 0,
		rouletteSpinsLeft: DEFAULT_DAILY_ROULETTE_SPINS,
		lastLoginDate: today,
		streak: gap === 1 ? (profile.streak || 0) + 1 : 1,
	};

	return {
		...state,
		profile: nextProfile,
		tasks: normalizeTasks(state.tasks).map(task => ({ ...task, completed: false })),
	};
}

function loadPersistedState(): PersistedState {
	const baseState = createBaseState();

	try {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved) {
			const parsed = JSON.parse(saved) as Partial<PersistedState>;
			return settleRevenueState(resetDailyState({
				version: 3,
				deviceId: parsed.deviceId || createDeviceId(),
				profile: normalizeProfile(parsed.profile),
				tasks: normalizeTasks(parsed.tasks),
				withdrawals: parsed.withdrawals?.length ? parsed.withdrawals : createInitialWithdrawals(),
				revenueEvents: normalizeRevenueEvents(parsed.revenueEvents),
			}));
		}

		const legacy = localStorage.getItem(LEGACY_PROFILE_KEY);
		if (legacy) {
			const parsedProfile = JSON.parse(legacy) as Partial<UserProfile>;
			return settleRevenueState(resetDailyState({
				...baseState,
				profile: normalizeProfile(parsedProfile),
			}));
		}
	} catch {
		return baseState;
	}

	return settleRevenueState(baseState);
}

function buildMissions(profile: UserProfile): MissionItem[] {
	return [
		{
			id: 'daily-tasks',
			label: 'Completar 3 tarefas',
			description: 'Mantém o usuário ativo e libera boost de payout.',
			target: 3,
			progress: Math.min(profile.dailyTasksCompleted, 3),
			reward: 30,
			completed: profile.dailyTasksCompleted >= 3,
		},
		{
			id: 'daily-games',
			label: 'Jogar 2 mini jogos',
			description: 'Aumenta retenção sem depender só de anúncios.',
			target: 2,
			progress: Math.min(profile.dailyGamesPlayed, 2),
			reward: 20,
			completed: profile.dailyGamesPlayed >= 2,
		},
		{
			id: 'daily-ads',
			label: 'Ver 2 anúncios qualificados',
			description: 'Desbloqueia mais participação na receita do dia.',
			target: 2,
			progress: Math.min(profile.dailyAdViews, 2),
			reward: 25,
			completed: profile.dailyAdViews >= 2,
		},
	];
}

function buildLeaderboard(profile: UserProfile, current: LeaderboardEntry[]) {
	const withoutCurrent = current.filter(entry => entry.id !== 'current-user');
	return [
		{ id: 'current-user', name: profile.name, points: profile.points, avatar: profile.avatar },
		...withoutCurrent,
	]
		.sort((a, b) => b.points - a.points)
		.slice(0, 5);
}

function mapProfileToClientRow(userId: string, profile: UserProfile) {
	return {
		id: userId,
		display_name: profile.name,
		avatar: profile.avatar,
		level: profile.level,
		xp: profile.xp,
		xp_to_next: profile.xpToNext,
		points: profile.points,
		streak: profile.streak,
		tasks_completed: profile.tasksCompleted,
		games_played: profile.gamesPlayed,
		daily_bonus_claimed: profile.dailyBonusClaimed,
		daily_tasks_completed: profile.dailyTasksCompleted,
		daily_ad_views: profile.dailyAdViews,
		daily_games_played: profile.dailyGamesPlayed,
		roulette_spins_left: profile.rouletteSpinsLeft,
		last_login_date: profile.lastLoginDate,
	};
}

function mapRowToProfile(row: RemoteProfileRow) {
	return normalizeProfile({
		name: row.display_name || 'Jogador',
		avatar: row.avatar || '🎮',
		hasCompletedOnboarding: true,
		level: row.level || 1,
		xp: row.xp || 0,
		xpToNext: row.xp_to_next || 100,
		points: row.points || 0,
		withdrawablePoints: row.withdrawable_points || 0,
		pendingWithdrawablePoints: row.pending_withdrawable_points || 0,
		totalWithdrawnPoints: row.total_withdrawn_points || 0,
		referralEarningsCents: row.referral_earnings_cents || 0,
		pendingReferralEarningsCents: row.pending_referral_earnings_cents || 0,
		availableReferralEarningsCents: row.available_referral_earnings_cents || 0,
		balance: row.balance || 0,
		riskScore: row.risk_score || 0,
		riskLevel: row.risk_level || 'low',
		withdrawalBlocked: Boolean(row.withdrawal_blocked),
		streak: row.streak || 1,
		tasksCompleted: row.tasks_completed || 0,
		gamesPlayed: row.games_played || 0,
		referralCode: row.referral_code || createReferralCode(),
		referralCount: row.referral_count || 0,
		referredByCode: row.referred_by_code || null,
		dailyBonusClaimed: Boolean(row.daily_bonus_claimed),
		dailyTasksCompleted: row.daily_tasks_completed || 0,
		dailyAdViews: row.daily_ad_views || 0,
		dailyGamesPlayed: row.daily_games_played || 0,
		rouletteSpinsLeft: row.roulette_spins_left || DEFAULT_DAILY_ROULETTE_SPINS,
		qualifiedRevenueCents: row.qualified_revenue_cents || 0,
		userShareCents: row.user_share_cents || 0,
		operatorShareCents: row.operator_share_cents || 0,
		reserveShareCents: row.reserve_share_cents || 0,
		lastLoginDate: row.last_login_date || toDateOnly(),
	});
}

function mapRevenueEventRow(row: {
	id: string;
	event_kind: RevenueEventKind | null;
	origin_user_id: string | null;
	source_id: string | null;
	source_type: TaskType;
	title: string | null;
	qualified_revenue_cents: number | null;
	user_share_cents: number | null;
	operator_share_cents: number | null;
	reserve_share_cents: number | null;
	status: RevenueEventStatus;
	created_at: string;
	available_at: string;
	payout_model_version: string | null;
}): RevenueEvent {
	return {
		id: row.id,
		eventKind: row.event_kind || 'task',
		originUserId: row.origin_user_id || undefined,
		sourceId: row.source_id || undefined,
		sourceType: row.source_type,
		title: row.title || 'Tarefa',
		qualifiedRevenueCents: row.qualified_revenue_cents || 0,
		userShareCents: row.user_share_cents || 0,
		operatorShareCents: row.operator_share_cents || 0,
		reserveShareCents: row.reserve_share_cents || 0,
		status: row.status,
		createdAt: row.created_at,
		availableAt: row.available_at,
		payoutModelVersion: row.payout_model_version || 'v2-80-20-settlement',
	};
}

function mapAdminWithdrawalRow(row: {
	id: string;
	user_id: string;
	user_name: string | null;
	user_avatar: string | null;
	pix_key: string;
	amount_brl: number | string;
	points_used: number;
	status: 'pending' | 'approved' | 'paid' | 'rejected';
	created_at: string;
	processed_at: string | null;
	admin_note: string | null;
	locked_revenue_points: number | null;
	locked_events_count: number | null;
	risk_score: number | null;
	risk_level: 'low' | 'medium' | 'high' | null;
	fraud_hold: boolean | null;
}): AdminWithdrawalItem {
	return {
		id: row.id,
		userId: row.user_id,
		userName: row.user_name || 'Jogador',
		userAvatar: row.user_avatar || '🎮',
		pixKey: row.pix_key,
		amountBrl: Number(row.amount_brl),
		pointsUsed: row.points_used,
		status: row.status,
		createdAt: row.created_at,
		processedAt: row.processed_at,
		adminNote: row.admin_note,
		lockedRevenuePoints: row.locked_revenue_points || 0,
		lockedEventsCount: row.locked_events_count || 0,
		riskScore: row.risk_score || 0,
		riskLevel: row.risk_level || 'low',
		fraudHold: Boolean(row.fraud_hold),
	};
}

function mapReferralLeaderboardRow(row: {
	user_id: string;
	user_name: string | null;
	user_avatar: string | null;
	referral_count: number | null;
	total_referral_earnings_cents: number | null;
	available_referral_earnings_cents: number | null;
	risk_level: 'low' | 'medium' | 'high' | null;
}): ReferralLeaderboardEntry {
	return {
		id: row.user_id,
		name: row.user_name || 'Jogador',
		avatar: row.user_avatar || '🎮',
		referralCount: row.referral_count || 0,
		totalReferralEarningsCents: row.total_referral_earnings_cents || 0,
		availableReferralEarningsCents: row.available_referral_earnings_cents || 0,
		riskLevel: row.risk_level || 'low',
	};
}

export function GameProvider({ children }: { children: ReactNode }) {
	const initialState = useMemo(loadPersistedState, []);
	const [state, setState] = useState<PersistedState>(initialState);
	const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(() => buildLeaderboard(initialState.profile, createInitialLeaderboard()));
	const [mode, setMode] = useState<AppMode>(isSupabaseConfigured ? 'connecting' : 'local');
	const [userId, setUserId] = useState<string | null>(null);
	const [sessionEmail, setSessionEmail] = useState<string | null>(null);
	const [isAdmin, setIsAdmin] = useState(false);
	const [adminRole, setAdminRole] = useState<AdminRole | null>(null);
	const [adminWithdrawals, setAdminWithdrawals] = useState<AdminWithdrawalItem[]>([]);
	const [referralLeaderboard, setReferralLeaderboard] = useState<ReferralLeaderboardEntry[]>([]);
	const autoReferralAttemptedRef = useRef(false);

	const { profile, tasks, withdrawals, revenueEvents, deviceId } = state;
	const isAuthenticated = mode === 'local' ? true : Boolean(userId);

	useEffect(() => {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
		localStorage.setItem(LEGACY_PROFILE_KEY, JSON.stringify(state.profile));
	}, [state]);

	useEffect(() => {
		setLeaderboard(previous => buildLeaderboard(profile, previous.length ? previous : createInitialLeaderboard()));
	}, [profile]);

	useEffect(() => {
		const interval = window.setInterval(() => {
			setState(previous => settleRevenueState(previous));
		}, 60_000);

		return () => window.clearInterval(interval);
	}, []);

	const syncProfile = useCallback(
		async (nextProfile: UserProfile, uid = userId) => {
			if (!supabase || !uid) return;
			await supabase.from('profiles').upsert(mapProfileToClientRow(uid, nextProfile));
		},
		[userId],
	);

	const refreshAdminWithdrawals = useCallback(
		async (uid = userId) => {
			if (!supabase || !uid) {
				setAdminWithdrawals([]);
				return;
			}

			const response = await supabase.rpc('get_admin_withdrawal_queue');
			if (response.error) {
				setAdminWithdrawals([]);
				return;
			}

			setAdminWithdrawals(
				((response.data || []) as Array<{
					id: string;
					user_id: string;
					user_name: string | null;
					user_avatar: string | null;
					pix_key: string;
					amount_brl: number | string;
					points_used: number;
					status: 'pending' | 'approved' | 'paid' | 'rejected';
					created_at: string;
					processed_at: string | null;
					admin_note: string | null;
					locked_revenue_points: number | null;
					locked_events_count: number | null;
					risk_score: number | null;
					risk_level: 'low' | 'medium' | 'high' | null;
					fraud_hold: boolean | null;
				}>).map(mapAdminWithdrawalRow),
			);
		},
		[userId],
	);

	const refreshReferralLeaderboard = useCallback(async () => {
		if (!supabase) {
			setReferralLeaderboard([]);
			return;
		}

		const response = await supabase.rpc('get_top_referrers', { p_limit: 8 });
		if (response.error) {
			setReferralLeaderboard([]);
			return;
		}

		setReferralLeaderboard(
			((response.data || []) as Array<{
				user_id: string;
				user_name: string | null;
				user_avatar: string | null;
				referral_count: number | null;
				total_referral_earnings_cents: number | null;
				available_referral_earnings_cents: number | null;
				risk_level: 'low' | 'medium' | 'high' | null;
			}>).map(mapReferralLeaderboardRow),
		);
	}, []);

	const refreshAdminState = useCallback(
		async (uid = userId) => {
			if (!supabase || !uid) {
				setIsAdmin(false);
				setAdminRole(null);
				setAdminWithdrawals([]);
				return;
			}

			const response = await supabase.rpc('get_my_admin_status');
			if (response.error) {
				setIsAdmin(false);
				setAdminRole(null);
				setAdminWithdrawals([]);
				return;
			}

			const payload = (response.data as { is_admin?: boolean; role?: AdminRole | null } | null) || null;
			const nextIsAdmin = Boolean(payload?.is_admin);
			setIsAdmin(nextIsAdmin);
			setAdminRole(payload?.role || null);

			if (nextIsAdmin) {
				await refreshAdminWithdrawals(uid);
			} else {
				setAdminWithdrawals([]);
			}
		},
		[refreshAdminWithdrawals, userId],
	);

	const refreshRemoteState = useCallback(
		async (uid = userId) => {
			if (!supabase || !uid) return;

			await supabase.rpc('ensure_profile_row');
			await supabase.rpc('settle_pending_revenue');

			const [profileResponse, completionResponse, withdrawalResponse, leaderboardResponse, revenueResponse] = await Promise.all([
				supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
				supabase.from('task_completions').select('task_id').eq('user_id', uid).gte('completed_at', `${toDateOnly()}T00:00:00.000Z`),
				supabase
					.from('withdraw_requests')
					.select('id, amount_brl, points_used, status, created_at')
					.eq('user_id', uid)
					.order('created_at', { ascending: false })
					.limit(10),
				supabase.from('profiles').select('id, display_name, avatar, points').order('points', { ascending: false }).limit(5),
				supabase
					.from('revenue_events')
					.select('id, event_kind, origin_user_id, source_id, source_type, title, qualified_revenue_cents, user_share_cents, operator_share_cents, reserve_share_cents, status, created_at, available_at, payout_model_version')
					.eq('user_id', uid)
					.order('created_at', { ascending: false })
					.limit(20),
			]);

			const mergedProfile = profileResponse.data ? mapRowToProfile(profileResponse.data as RemoteProfileRow) : initialState.profile;
			const completedTaskIds = new Set((completionResponse.data || []).map(item => item.task_id));
			const remoteWithdrawals: WithdrawalRecord[] = (withdrawalResponse.data || []).map(item => ({
				id: item.id,
				amount: Number(item.amount_brl),
				points: item.points_used,
				status: item.status,
				date: String(item.created_at).slice(0, 10),
			}));
			const remoteLeaderboard: LeaderboardEntry[] = (leaderboardResponse.data || []).map(item => ({
				id: item.id,
				name: item.display_name || 'Jogador',
				avatar: item.avatar || '🎮',
				points: item.points || 0,
			}));
			const remoteRevenueEvents: RevenueEvent[] = (revenueResponse.data || []).map(item =>
				mapRevenueEventRow(item as {
					id: string;
					event_kind: RevenueEventKind | null;
					origin_user_id: string | null;
					source_id: string | null;
					source_type: TaskType;
					title: string | null;
					qualified_revenue_cents: number | null;
					user_share_cents: number | null;
					operator_share_cents: number | null;
					reserve_share_cents: number | null;
					status: RevenueEventStatus;
					created_at: string;
					available_at: string;
					payout_model_version: string | null;
				}),
			);

			setState(prev => ({
				...prev,
				profile: mergedProfile,
				tasks: normalizeTasks(prev.tasks).map(task => ({
					...task,
					completed: completedTaskIds.has(task.id),
				})),
				withdrawals: remoteWithdrawals.length ? remoteWithdrawals : prev.withdrawals,
				revenueEvents: remoteRevenueEvents,
			}));
			setLeaderboard(buildLeaderboard(mergedProfile, remoteLeaderboard.length ? remoteLeaderboard : createInitialLeaderboard()));
			await Promise.all([refreshAdminState(uid), refreshReferralLeaderboard()]);
			setMode('supabase');
		},
		[initialState.profile, refreshAdminState, refreshReferralLeaderboard, userId],
	);

	useEffect(() => {
		if (!isSupabaseConfigured || !supabase) {
			setMode('local');
			return;
		}

		let cancelled = false;
		let unsubscribe: (() => void) | undefined;

		const resetToGuestState = () => {
			setUserId(null);
			setSessionEmail(null);
			setIsAdmin(false);
			setAdminRole(null);
			setAdminWithdrawals([]);
			setReferralLeaderboard([]);
			setState(prev => createBaseState(prev.deviceId));
			setMode('supabase');
		};

		const syncSession = async (session: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']) => {
			const uid = session?.user?.id;
			if (!uid) {
				if (!cancelled) {
					resetToGuestState();
				}
				return;
			}

			if (cancelled) return;
			setUserId(uid);
			setSessionEmail(session?.user?.email || null);
			await refreshRemoteState(uid);
		};

		const bootstrap = async () => {
			try {
				setMode('connecting');
				const session = (await supabase.auth.getSession()).data.session;
				await syncSession(session);

				const authListener = supabase.auth.onAuthStateChange((_event, nextSession) => {
					void syncSession(nextSession);
				});
				unsubscribe = () => authListener.data.subscription.unsubscribe();
			} catch {
				if (!cancelled) {
					resetToGuestState();
				}
			}
		};

		bootstrap();

		return () => {
			cancelled = true;
			unsubscribe?.();
		};
	}, [refreshRemoteState]);

	const updateProfile = useCallback(
		(updates: Partial<UserProfile>) => {
			let nextProfile = profile;
			setState(prev => {
				nextProfile = { ...prev.profile, ...updates };
				return { ...prev, profile: nextProfile };
			});
			void syncProfile(nextProfile);
		},
		[profile, syncProfile],
	);

	const completeOnboarding = useCallback(
		async (name: string, avatar: string) => {
			const normalizedName = name.trim();
			if (!normalizedName) {
				return;
			}

			let nextProfile = profile;
			setState(prev => {
				nextProfile = {
					...prev.profile,
					name: normalizedName,
					avatar,
					hasCompletedOnboarding: true,
				};
				return { ...prev, profile: nextProfile };
			});

			await syncProfile(nextProfile);
		},
		[profile, syncProfile],
	);

	const addPoints = useCallback(
		(amount: number, xpAmount?: number) => {
			let nextProfile = profile;
			setState(prev => {
				const xpState = calculateXpProgress(prev.profile, amount, xpAmount);
				nextProfile = {
					...prev.profile,
					points: prev.profile.points + amount,
					...xpState,
				};
				return { ...prev, profile: nextProfile };
			});
			void syncProfile(nextProfile);
		},
		[profile, syncProfile],
	);

	const completeTask = useCallback(
		async (points: number, options?: CompleteTaskOptions) => {
			const currentTask = options?.taskId ? tasks.find(task => task.id === options.taskId) : undefined;
			if (currentTask?.completed) return;

			if (supabase && userId && options?.taskId && mode === 'supabase') {
				const response = await supabase.rpc('complete_task_secure', { p_task_id: options.taskId, p_device_fingerprint: deviceId });
				if (response.error) {
					throw response.error;
				}

				await refreshRemoteState(userId);
				return;
			}

			let nextProfile = profile;
			const qualifiedRevenueCents = options?.estimatedRevenueCents || currentTask?.estimatedRevenueCents || 0;
			const revenue = calculateRevenueDistribution(qualifiedRevenueCents);
			const scorePoints = points;
			const cashPoints = revenue.userShareCents;
			const revenueEvent: RevenueEvent | null = qualifiedRevenueCents
				? {
					id: createRevenueEventId(),
					eventKind: 'task',
					originUserId: undefined,
					sourceId: options?.taskId,
					sourceType: options?.taskType || currentTask?.type || 'link',
					title: options?.title || currentTask?.title || 'Tarefa',
					qualifiedRevenueCents,
					userShareCents: cashPoints,
					operatorShareCents: revenue.operatorShareCents,
					reserveShareCents: revenue.reserveShareCents,
					status: 'pending',
					createdAt: new Date().toISOString(),
					availableAt: addDaysIso(REVENUE_SETTLEMENT_DAYS),
					payoutModelVersion: 'v2-80-20-settlement',
				}
				: null;

			setState(prev => {
				const xpState = calculateXpProgress(prev.profile, scorePoints);
				nextProfile = {
					...prev.profile,
					points: prev.profile.points + scorePoints,
					pendingWithdrawablePoints: prev.profile.pendingWithdrawablePoints + cashPoints,
					balance: Number(pointsToBrl(prev.profile.withdrawablePoints)),
					tasksCompleted: prev.profile.tasksCompleted + 1,
					dailyTasksCompleted: prev.profile.dailyTasksCompleted + 1,
					dailyAdViews:
						(options?.taskType || currentTask?.type) === 'ad' ? prev.profile.dailyAdViews + 1 : prev.profile.dailyAdViews,
					qualifiedRevenueCents: prev.profile.qualifiedRevenueCents + revenue.qualifiedRevenueCents,
					userShareCents: prev.profile.userShareCents + revenue.userShareCents,
					operatorShareCents: prev.profile.operatorShareCents + revenue.operatorShareCents,
					reserveShareCents: prev.profile.reserveShareCents + revenue.reserveShareCents,
					...xpState,
				};
				return {
					...prev,
					profile: nextProfile,
					revenueEvents: revenueEvent ? [revenueEvent, ...prev.revenueEvents] : prev.revenueEvents,
					tasks: prev.tasks.map(task =>
						task.id === options?.taskId ? { ...task, completed: true } : task,
					),
				};
			});

			await syncProfile(nextProfile);

			if (supabase && userId && options?.taskId) {
				await supabase.from('task_completions').insert({
					user_id: userId,
					task_id: options.taskId,
					task_type: options.taskType || currentTask?.type || 'link',
					title: options.title || currentTask?.title || 'Tarefa',
					estimated_revenue_cents: options.estimatedRevenueCents || currentTask?.estimatedRevenueCents || 0,
					earned_points: scorePoints,
				});

				if (revenue.qualifiedRevenueCents > 0) {
					await supabase.from('revenue_events').insert({
						id: revenueEvent?.id,
						user_id: userId,
						source_type: options.taskType || currentTask?.type || 'link',
						source_id: options.taskId,
						qualified_revenue_cents: revenue.qualifiedRevenueCents,
						user_share_cents: revenue.userShareCents,
						operator_share_cents: revenue.operatorShareCents,
						reserve_share_cents: revenue.reserveShareCents,
						payout_model_version: 'v2-80-20-settlement',
					});
				}
			}
		},
		[deviceId, mode, profile, refreshRemoteState, syncProfile, tasks, userId],
	);

	const claimDailyBonus = useCallback(() => {
		if (profile.dailyBonusClaimed) return 0;

		const baseBonus = 10 + Math.min(profile.streak * 2, 25);
		const bonus = profile.streak > 0 && profile.streak % 7 === 0 ? baseBonus * 2 : baseBonus;
		let nextProfile = profile;

		setState(prev => {
			const xpState = calculateXpProgress(prev.profile, bonus, Math.max(5, Math.floor(bonus / 2)));
			nextProfile = {
				...prev.profile,
				points: prev.profile.points + bonus,
				dailyBonusClaimed: true,
				...xpState,
			};
			return { ...prev, profile: nextProfile };
		});

		void syncProfile(nextProfile);
		return bonus;
	}, [profile, syncProfile]);

	const useRouletteSpin = useCallback(() => {
		if (profile.rouletteSpinsLeft <= 0) return false;

		let nextProfile = profile;
		setState(prev => {
			nextProfile = {
				...prev.profile,
				rouletteSpinsLeft: prev.profile.rouletteSpinsLeft - 1,
				gamesPlayed: prev.profile.gamesPlayed + 1,
				dailyGamesPlayed: prev.profile.dailyGamesPlayed + 1,
			};
			return { ...prev, profile: nextProfile };
		});

		void syncProfile(nextProfile);
		return true;
	}, [profile, syncProfile]);

	const incrementGamesPlayed = useCallback(() => {
		let nextProfile = profile;
		setState(prev => {
			nextProfile = {
				...prev.profile,
				gamesPlayed: prev.profile.gamesPlayed + 1,
				dailyGamesPlayed: prev.profile.dailyGamesPlayed + 1,
			};
			return { ...prev, profile: nextProfile };
		});
		void syncProfile(nextProfile);
	}, [profile, syncProfile]);

	const requestWithdrawal = useCallback(
		async (pixKey: string): Promise<WithdrawalResult> => {
			const normalizedPixKey = pixKey.trim();
			if (!normalizedPixKey) {
				return { ok: false, message: 'Informe uma chave Pix válida.' };
			}

			if (supabase && userId && mode === 'supabase') {
				const response = await supabase.rpc('request_withdrawal_secure', { p_pix_key: normalizedPixKey, p_device_fingerprint: deviceId });
				if (response.error) {
					return { ok: false, message: response.error.message };
				}

				await refreshRemoteState(userId);
				return {
					ok: true,
					message: String((response.data as { message?: string } | null)?.message || 'Solicitação enviada com sucesso.'),
				};
			}

			if (!isPixKeyValid(normalizedPixKey)) {
				return {
					ok: false,
					message: 'Use uma chave Pix válida: e-mail, celular, CPF, CNPJ ou chave aleatória.',
				};
			}

			const pendingWithdrawals = withdrawals.filter(withdrawal => withdrawal.status === 'pending');
			if (pendingWithdrawals.length >= MAX_PENDING_WITHDRAWALS) {
				return {
					ok: false,
					message: 'Já existe um saque pendente. Libere o próximo somente após a conferência manual.',
				};
			}

			const today = toDateOnly();
			const todayWithdrawals = withdrawals.filter(withdrawal => withdrawal.date === today);
			if (todayWithdrawals.length >= MAX_DAILY_WITHDRAWALS) {
				return {
					ok: false,
					message: 'Limite diário de saques atingido. Isso reduz risco operacional e chargeback.',
				};
			}

			if (profile.withdrawablePoints < MIN_WITHDRAW_POINTS) {
				return {
					ok: false,
					message: `O mínimo para saque é R$ ${pointsToBrl(MIN_WITHDRAW_POINTS)}.`,
				};
			}

			const pointsUsed = profile.withdrawablePoints;
			const amount = Number(pointsToBrl(pointsUsed));
			const withdrawal: WithdrawalRecord = {
				id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `w-${Date.now()}`,
				amount,
				points: pointsUsed,
				status: 'pending',
				date: toDateOnly(),
			};

			let nextProfile = profile;

			setState(prev => {
				const nextRevenueEvents = consumeAvailableRevenueEvents(prev.revenueEvents, pointsUsed);
				nextProfile = {
					...prev.profile,
					withdrawablePoints: Math.max(0, prev.profile.withdrawablePoints - pointsUsed),
					totalWithdrawnPoints: prev.profile.totalWithdrawnPoints + pointsUsed,
					balance: Math.max(0, Number(pointsToBrl(prev.profile.withdrawablePoints - pointsUsed))),
				};
				return {
					...prev,
					profile: nextProfile,
					withdrawals: [withdrawal, ...prev.withdrawals],
					revenueEvents: nextRevenueEvents,
				};
			});

			await syncProfile(nextProfile);

			if (supabase && userId) {
				await supabase.from('withdraw_requests').insert({
					id: withdrawal.id,
					user_id: userId,
					pix_key: normalizedPixKey,
					points_used: pointsUsed,
					amount_brl: amount,
					status: 'pending',
				});
			}

			return { ok: true, message: 'Solicitação enviada. Só o saldo liquidado entra em saque, reduzindo risco para a operação.' };
		},
		[deviceId, mode, profile, refreshRemoteState, syncProfile, userId, withdrawals],
	);

	const applyReferralCode = useCallback(
		async (referralCode: string): Promise<WithdrawalResult> => {
			const normalizedCode = referralCode.trim().toUpperCase();

			if (!normalizedCode) {
				return { ok: false, message: 'Informe um código de indicação válido.' };
			}

			if (normalizedCode === profile.referralCode) {
				return { ok: false, message: 'Você não pode usar o próprio código de indicação.' };
			}

			if (profile.referredByCode) {
				return { ok: false, message: 'Sua conta já está vinculada a um indicador.' };
			}

			if (!supabase || !userId || mode !== 'supabase') {
				return { ok: false, message: 'A vinculação por indicação exige Supabase conectado.' };
			}

			const response = await supabase.rpc('apply_referral_code', { p_referral_code: normalizedCode, p_device_fingerprint: deviceId });
			if (response.error) {
				return { ok: false, message: response.error.message };
			}

			await refreshRemoteState(userId);
			return {
				ok: true,
				message: String((response.data as { message?: string } | null)?.message || 'Código aplicado com sucesso.'),
			};
		},
		[deviceId, mode, profile.referralCode, profile.referredByCode, refreshRemoteState, userId],
	);

	useEffect(() => {
		if (!supabase || mode !== 'supabase' || !userId || autoReferralAttemptedRef.current || profile.referredByCode) {
			return;
		}

		const params = new URLSearchParams(window.location.search);
		const referralCode = params.get('ref');
		if (!referralCode) {
			autoReferralAttemptedRef.current = true;
			return;
		}

		autoReferralAttemptedRef.current = true;
		void applyReferralCode(referralCode).finally(() => {
			params.delete('ref');
			const nextSearch = params.toString();
			const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`;
			window.history.replaceState({}, '', nextUrl);
		});
	}, [applyReferralCode, mode, profile.referredByCode, userId]);

	const signInWithEmail = useCallback(
		async (email: string, password: string): Promise<WithdrawalResult> => {
			if (!supabase) {
				return { ok: false, message: 'O login por e-mail exige Supabase configurado.' };
			}

			const response = await supabase.auth.signInWithPassword({
				email: email.trim(),
				password,
			});

			if (response.error) {
				return { ok: false, message: response.error.message };
			}

			const uid = response.data.user?.id;
			if (uid) {
				await refreshRemoteState(uid);
			}

			return { ok: true, message: 'Login realizado com sucesso.' };
		},
		[refreshRemoteState],
	);

	const signUpWithEmail = useCallback(
		async (email: string, password: string, avatar: string, referralCode?: string): Promise<WithdrawalResult> => {
			if (!supabase) {
				return { ok: false, message: 'O cadastro por e-mail exige Supabase configurado.' };
			}

			const normalizedEmail = email.trim();
			const normalizedName = createDisplayNameFromEmail(normalizedEmail);
			const normalizedReferralCode = referralCode?.trim().toUpperCase() || '';
			const response = await supabase.auth.signUp({
				email: normalizedEmail,
				password,
				options: {
					data: {
						display_name: normalizedName,
						avatar,
					},
				},
			});

			if (response.error) {
				return { ok: false, message: response.error.message };
			}

			if (response.data.session && response.data.user) {
				await completeOnboarding(normalizedName, avatar);
				if (normalizedReferralCode) {
					const referralResult = await applyReferralCode(normalizedReferralCode);
					if (!referralResult.ok) {
						return referralResult;
					}
				}
				return { ok: true, message: 'Conta criada e login realizado com sucesso.' };
			}

			return {
				ok: true,
				message: 'Conta criada. Se o Supabase exigir confirmação de e-mail, confirme sua caixa de entrada e depois faça login.',
			};
		},
		[applyReferralCode, completeOnboarding],
	);

	const signOut = useCallback(async () => {
		if (!supabase) {
			setState(prev => createBaseState(prev.deviceId));
			return;
		}

		await supabase.auth.signOut();
		setState(prev => createBaseState(prev.deviceId));
	}, []);

	const reviewWithdrawalRequest = useCallback(
		async (requestId: string, action: AdminWithdrawalAction, adminNote?: string): Promise<WithdrawalResult> => {
			if (!supabase || !userId || mode !== 'supabase') {
				return { ok: false, message: 'O painel administrativo exige Supabase conectado.' };
			}

			const response = await supabase.rpc('review_withdrawal_request', {
				p_request_id: requestId,
				p_action: action,
				p_admin_note: adminNote?.trim() || null,
			});

			if (response.error) {
				return { ok: false, message: response.error.message };
			}

			await refreshRemoteState(userId);
			await refreshAdminWithdrawals(userId);

			return {
				ok: true,
				message: String((response.data as { message?: string } | null)?.message || 'Ação administrativa concluída.'),
			};
		},
		[mode, refreshAdminWithdrawals, refreshRemoteState, userId],
	);

	const missions = useMemo(() => buildMissions(profile), [profile]);

	const economy = useMemo<EconomySnapshot>(() => {
		const model = calculateRevenueDistribution(100);
		const pendingUserShareCents = profile.pendingWithdrawablePoints;
		const availableUserShareCents = profile.withdrawablePoints;
		return {
			qualifiedRevenueCents: profile.qualifiedRevenueCents,
			userShareCents: profile.userShareCents,
			pendingUserShareCents,
			availableUserShareCents,
			siteShareCents: profile.operatorShareCents + profile.reserveShareCents,
			operatorShareCents: profile.operatorShareCents,
			reserveShareCents: profile.reserveShareCents,
			userSharePct: model.userSharePct,
			directReferralPct: model.directReferralPct,
			indirectReferralPct: model.indirectReferralPct,
			siteSharePct: model.siteSharePct,
			operatorSharePct: model.operatorSharePct,
			reserveSharePct: model.reserveSharePct,
			settlementDays: REVENUE_SETTLEMENT_DAYS,
			recommendedModel: '80% da receita qualificada vai para o usuário, 3% para indicação direta, 1% para indireta e 16% ficam para o site. O saque usa apenas saldo liquidado após validação e análise de risco.',
			modeLabel: mode === 'supabase' ? 'Supabase conectado' : mode === 'connecting' ? 'Conectando Supabase' : 'Modo local com fallback',
		};
	}, [mode, profile]);

	const value = useMemo<GameContextValue>(
		() => ({
			profile,
			tasks,
			withdrawals,
			revenueEvents,
			sessionUserId: userId,
			sessionEmail,
			isAuthenticated,
			isAdmin,
			adminRole,
			adminWithdrawals,
			referralLeaderboard,
			leaderboard,
			missions,
			economy,
			mode,
			signInWithEmail,
			signUpWithEmail,
			signOut,
			updateProfile,
			completeOnboarding,
			addPoints,
			completeTask,
			claimDailyBonus,
			useRouletteSpin,
			incrementGamesPlayed,
			requestWithdrawal,
			applyReferralCode,
			refreshAdminWithdrawals: () => refreshAdminWithdrawals(),
			reviewWithdrawalRequest,
		}),
		[
			profile,
			tasks,
			withdrawals,
			revenueEvents,
			userId,
			sessionEmail,
			isAuthenticated,
			isAdmin,
			adminRole,
			adminWithdrawals,
			referralLeaderboard,
			leaderboard,
			missions,
			economy,
			mode,
			signInWithEmail,
			signUpWithEmail,
			signOut,
			updateProfile,
			completeOnboarding,
			addPoints,
			completeTask,
			claimDailyBonus,
			useRouletteSpin,
			incrementGamesPlayed,
			requestWithdrawal,
			applyReferralCode,
			refreshAdminWithdrawals,
			reviewWithdrawalRequest,
		],
	);

	return createElement(GameContext.Provider, { value }, children);
}

export function useGameStore() {
	const context = useContext(GameContext);
	if (!context) {
		throw new Error('useGameStore precisa ser usado dentro de GameProvider');
	}
	return context;
}
