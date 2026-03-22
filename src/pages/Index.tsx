import { FormEvent, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ArrowRight, LockKeyhole, Mail, ShieldCheck, Sparkles, Star } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { useGameStore } from '@/stores/useGameStore';

const avatars = ['🎮', '🚀', '🦊', '🐼', '🐯', '🦄', '🐸', '🔥'];

type AuthTab = 'signup' | 'signin';

export default function Index() {
	const {
		profile,
		mode,
		sessionUserId,
		sessionEmail,
		isAuthenticated,
		signInWithEmail,
		signUpWithEmail,
		completeOnboarding,
		applyReferralCode,
	} = useGameStore();
	const location = useLocation();
	const [tab, setTab] = useState<AuthTab>('signup');
	const [avatar, setAvatar] = useState(profile.avatar || avatars[0]);
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [referralCode, setReferralCode] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	const urlReferralCode = useMemo(() => new URLSearchParams(location.search).get('ref') || '', [location.search]);
	const detectedReferralCode = (referralCode.trim() || urlReferralCode).toUpperCase();
	const needsProfileCompletion = mode !== 'local' && Boolean(sessionUserId) && !profile.hasCompletedOnboarding;
	const shouldRedirect = profile.hasCompletedOnboarding && (mode === 'local' || Boolean(sessionUserId));
	const inferredName = useMemo(() => {
		const localPart = (sessionEmail || email).split('@')[0]?.trim() || profile.name || 'Jogador';
		const cleaned = localPart.replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim();
		if (!cleaned) return 'Jogador';
		return cleaned
			.split(' ')
			.map(part => part.charAt(0).toUpperCase() + part.slice(1))
			.join(' ');
	}, [email, profile.name, sessionEmail]);

	if (mode === 'connecting') {
		return (
			<div className="min-h-screen bg-background px-6 py-16 text-center">
				<div className="mx-auto max-w-md glass-card p-8 space-y-3">
					<p className="text-lg font-semibold">Conectando sua conta...</p>
					<p className="text-sm text-muted-foreground">Estamos preparando o acesso seguro ao app.</p>
				</div>
			</div>
		);
	}

	if (shouldRedirect && !error) {
		return <Navigate to="/dashboard" replace />;
	}

	const handleCompleteProfile = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		setSubmitting(true);
		setError(null);

		try {
			await completeOnboarding(inferredName, avatar);
			if (!profile.referredByCode && detectedReferralCode) {
				const result = await applyReferralCode(detectedReferralCode);
				if (!result.ok) {
					setError(result.message);
					return;
				}
				toast.success(result.message);
			}

			toast.success('Perfil concluído com sucesso.');
		} finally {
			setSubmitting(false);
		}
	};

	const handleAuth = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setSubmitting(true);
		setError(null);

		try {
			if (tab === 'signin') {
				const result = await signInWithEmail(email, password);
				if (!result.ok) {
					setError(result.message);
					return;
				}
				toast.success(result.message);
				return;
			}

			if (password.length < 6) {
				setError('A senha precisa ter pelo menos 6 caracteres.');
				return;
			}

			const result = await signUpWithEmail(email, password, avatar, detectedReferralCode);
			if (!result.ok) {
				setError(result.message);
				return;
			}

			toast.success(result.message);
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<div className="min-h-screen bg-background px-4 py-8">
			<div className="mx-auto max-w-5xl grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
				<section className="glass-card p-6 lg:p-8 space-y-6">
					<div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
						<Sparkles className="h-4 w-4" /> Ganhe dinheiro com atividades, check-in e microtarefas
					</div>
					<div className="space-y-3">
						<h1 className="text-3xl font-bold leading-tight lg:text-4xl">
							Crie sua conta para ganhar dinheiro com atividades, cliques e microtarefas.
						</h1>
						<p className="text-sm text-muted-foreground lg:text-base">
							Quanto mais tarefas você fizer e quanto mais pessoas indicar, mais você ganha. Entre agora e comece a acumular saldo com check-in diário, missões e comissões por indicação.
						</p>
					</div>

					<div className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/15 via-accent/10 to-background p-5 shadow-[0_0_30px_hsl(var(--primary)/0.12)]">
						<div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-primary">
							<span className="rounded-full bg-primary/10 px-3 py-1">Ganhos por tarefas</span>
							<span className="rounded-full bg-primary/10 px-3 py-1">Check-in diário</span>
							<span className="rounded-full bg-primary/10 px-3 py-1">Comissão por indicação</span>
						</div>
						<div className="mt-4 space-y-2">
							<p className="text-xl font-bold leading-snug lg:text-2xl">
								Faça atividades simples, conclua microtarefas e aumente seus ganhos todos os dias.
							</p>
							<p className="text-sm text-muted-foreground">
								Você ganha ao participar da plataforma e também pode crescer ainda mais indicando amigos. Produção maior significa mais pontos, mais saldo validado e mais chances de saque.
							</p>
						</div>
					</div>

					<div className="grid gap-3 sm:grid-cols-3">
						<div className="rounded-2xl border border-primary/15 bg-background/70 p-4 text-center shadow-sm">
							<p className="text-2xl font-bold text-primary">7 dias</p>
							<p className="mt-1 text-xs text-muted-foreground">de check-in para desbloquear bônus dobrado</p>
						</div>
						<div className="rounded-2xl border border-primary/15 bg-background/70 p-4 text-center shadow-sm">
							<p className="text-2xl font-bold text-primary">3%</p>
							<p className="mt-1 text-xs text-muted-foreground">de comissão nas indicações diretas qualificadas</p>
						</div>
						<div className="rounded-2xl border border-primary/15 bg-background/70 p-4 text-center shadow-sm">
							<p className="text-2xl font-bold text-primary">+ tarefas</p>
							<p className="mt-1 text-xs text-muted-foreground">mais atividade no app, mais saldo acumulado</p>
						</div>
					</div>

					<div className="grid gap-3 sm:grid-cols-3">
						<div className="rounded-2xl bg-secondary p-4">
							<Star className="mb-2 h-5 w-5 text-primary" />
							<p className="text-sm font-semibold">Ganhe todo dia</p>
							<p className="text-xs text-muted-foreground">Faça o check-in diário e no 7º dia receba um bônus dobrado para acelerar seus ganhos.</p>
						</div>
						<div className="rounded-2xl bg-secondary p-4">
							<Mail className="mb-2 h-5 w-5 text-accent" />
							<p className="text-sm font-semibold">Microtarefas que rendem</p>
							<p className="text-xs text-muted-foreground">Conclua atividades e missões rápidas para acumular saldo e evoluir dentro da plataforma.</p>
						</div>
						<div className="rounded-2xl bg-secondary p-4">
							<ShieldCheck className="mb-2 h-5 w-5 text-game-blue" />
							<p className="text-sm font-semibold">Indique e ganhe mais</p>
							<p className="text-xs text-muted-foreground">Além do que você produz, suas indicações também ajudam a aumentar seus ganhos com comissão recorrente.</p>
						</div>
					</div>

					<div className="rounded-3xl bg-secondary/70 p-5 space-y-4">
						<div>
							<p className="text-sm font-semibold">Como funciona</p>
							<p className="text-xs text-muted-foreground">Um caminho simples para começar a ganhar dentro da plataforma.</p>
						</div>
						<div className="grid gap-3 md:grid-cols-3">
							<div className="rounded-2xl bg-background p-4">
								<p className="text-xs font-semibold text-primary">1. Crie sua conta</p>
								<p className="mt-2 text-sm text-muted-foreground">Cadastre seu acesso, escolha um avatar e entre em poucos segundos.</p>
							</div>
							<div className="rounded-2xl bg-background p-4">
								<p className="text-xs font-semibold text-primary">2. Faça atividades</p>
								<p className="mt-2 text-sm text-muted-foreground">Conclua microtarefas, check-ins e missões para acumular pontos e saldo validado.</p>
							</div>
							<div className="rounded-2xl bg-background p-4">
								<p className="text-xs font-semibold text-primary">3. Indique e escale</p>
								<p className="mt-2 text-sm text-muted-foreground">Ganhe ainda mais com comissão sobre a produção qualificada das suas indicações.</p>
							</div>
						</div>
					</div>
				</section>

				<section className="glass-card p-6 lg:p-8">
					{needsProfileCompletion || mode === 'local' ? (
						<form className="space-y-5" onSubmit={handleCompleteProfile}>
							<div>
								<h2 className="text-xl font-semibold">Finalizar perfil</h2>
								<p className="text-sm text-muted-foreground">Seu nome será criado automaticamente com base no e-mail. Escolha só o avatar.</p>
							</div>
							<div className="rounded-2xl border border-border bg-secondary px-4 py-3 text-sm text-muted-foreground">
								Nome automático: <span className="font-semibold text-foreground">{inferredName}</span>
							</div>

							<div className="space-y-2">
								<label className="text-sm font-medium">Escolha um avatar</label>
								<div className="grid grid-cols-4 gap-2">
									{avatars.map(item => (
										<button
											key={item}
											type="button"
											onClick={() => setAvatar(item)}
											className={`rounded-2xl border p-3 text-2xl transition ${
												avatar === item ? 'border-primary bg-primary/10' : 'border-border bg-secondary'
											}`}
										>
											{item}
										</button>
									))}
								</div>
							</div>

							<div className="space-y-2">
								<label className="text-sm font-medium">Código de indicação</label>
								<input
									value={referralCode}
									onChange={(event) => setReferralCode(event.target.value.toUpperCase())}
									maxLength={16}
									placeholder={urlReferralCode || 'Opcional'}
									className="w-full rounded-2xl border border-border bg-secondary px-4 py-3 text-sm uppercase outline-none transition focus:border-primary"
								/>
								{urlReferralCode ? <p className="text-xs text-primary">Convite detectado: {urlReferralCode}</p> : null}
							</div>

							{error ? (
								<div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
									{error}
								</div>
							) : null}

							<button
								type="submit"
								disabled={submitting}
								className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
							>
								{submitting ? 'Salvando...' : 'Começar a ganhar agora'}
								<ArrowRight className="h-4 w-4" />
							</button>
						</form>
					) : (
						<form className="space-y-5" onSubmit={handleAuth}>
							<div className="flex rounded-2xl bg-secondary p-1">
								<button
									type="button"
									onClick={() => setTab('signup')}
									className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition ${tab === 'signup' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}
								>
									Criar conta
								</button>
								<button
									type="button"
									onClick={() => setTab('signin')}
									className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition ${tab === 'signin' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}
								>
									Entrar
								</button>
							</div>

							<div>
								<h2 className="text-xl font-semibold">{tab === 'signup' ? 'Cadastro' : 'Entrar na conta'}</h2>
								<p className="text-sm text-muted-foreground">
									{tab === 'signup'
										? 'Use e-mail e senha para criar sua conta no app.'
										: 'Acesse sua conta existente para continuar testando o fluxo.'}
								</p>
							</div>

							{tab === 'signup' ? (
								<>
									<div className="rounded-2xl border border-border bg-secondary px-4 py-3 text-sm text-muted-foreground">
										Nome automático: <span className="font-semibold text-foreground">{inferredName || 'Jogador'}</span>
									</div>

									<div className="space-y-2">
										<label className="text-sm font-medium">Avatar</label>
										<div className="grid grid-cols-4 gap-2">
											{avatars.map(item => (
												<button
													key={item}
													type="button"
													onClick={() => setAvatar(item)}
													className={`rounded-2xl border p-3 text-2xl transition ${avatar === item ? 'border-primary bg-primary/10' : 'border-border bg-secondary'}`}
												>
													{item}
												</button>
											))}
										</div>
									</div>

									<div className="space-y-2">
										<label className="text-sm font-medium">Código de indicação</label>
										<input
											value={referralCode}
											onChange={(event) => setReferralCode(event.target.value.toUpperCase())}
											maxLength={16}
											placeholder={urlReferralCode || 'Opcional'}
											className="w-full rounded-2xl border border-border bg-secondary px-4 py-3 text-sm uppercase outline-none transition focus:border-primary"
										/>
										{urlReferralCode ? <p className="text-xs text-primary">Convite detectado: {urlReferralCode}</p> : null}
									</div>
								</>
							) : null}

							<div className="space-y-2">
								<label className="text-sm font-medium">E-mail</label>
								<div className="flex items-center gap-2 rounded-2xl border border-border bg-secondary px-4 py-3">
									<Mail className="h-4 w-4 text-muted-foreground" />
									<input
										type="email"
										value={email}
										onChange={(event) => setEmail(event.target.value)}
										placeholder="voce@email.com"
										className="w-full bg-transparent text-sm outline-none"
									/>
								</div>
							</div>

							<div className="space-y-2">
								<label className="text-sm font-medium">Senha</label>
								<div className="flex items-center gap-2 rounded-2xl border border-border bg-secondary px-4 py-3">
									<LockKeyhole className="h-4 w-4 text-muted-foreground" />
									<input
										type="password"
										value={password}
										onChange={(event) => setPassword(event.target.value)}
										placeholder="******"
										className="w-full bg-transparent text-sm outline-none"
									/>
								</div>
								{tab === 'signup' ? <p className="text-xs text-muted-foreground">Use no mínimo 6 caracteres.</p> : null}
							</div>

							{error ? (
								<div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
									{error}
								</div>
							) : null}

							<button
								type="submit"
								disabled={submitting || (mode !== 'local' && tab !== 'signup' && !email.trim())}
								className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
							>
								{submitting ? (tab === 'signup' ? 'Criando conta...' : 'Entrando...') : tab === 'signup' ? 'Começar a ganhar agora' : 'Entrar agora'}
								<ArrowRight className="h-4 w-4" />
							</button>
						</form>
					)}
				</section>
			</div>
		</div>
	);
}
