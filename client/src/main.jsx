import React, { useEffect, useMemo, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
	Menu,
	Search,
	MessageSquare,
	UserRound,
	Wallet,
	Heart,
	Flame,
	Gamepad2,
	Trophy,
	Gift,
	ChevronRight,
	ChevronLeft,
	ArrowUpRight,
	History,
	LogOut,
	ShieldCheck,
	X,
	Plus,
	Minus,
	RefreshCw,
	LayoutDashboard,
	Users,
	CheckCircle,
	Clock,
	AlertCircle,
	ImagePlus,
	Trash2,
} from "lucide-react";
import "./style.css";
import { ASSET_GAME_CATALOG, ASSET_PROVIDER_CATALOG } from "./asset-catalog.js";
const API = (
	import.meta.env.VITE_API_URL || "http://localhost:4000/api"
).replace(/\/$/, "");
let csrfToken = "";
async function ensureCsrfToken() {
	if (csrfToken) return csrfToken;
	const r = await fetch(API + "/auth/csrf", { method: "GET", credentials: "include", cache: "no-store" });
	const d = await r.json().catch(() => ({}));
	if (!r.ok || typeof d.csrfToken !== "string" || d.csrfToken.length < 32) {
		throw new Error("Could not initialize request security. Refresh the page and try again.");
	}
	csrfToken = d.csrfToken;
	return csrfToken;
}
async function api(path, opts = {}) {
	const method = String(opts.method || "GET").toUpperCase();
	const headers = { ...(opts.headers || {}) };
	if (opts.body != null && !(opts.body instanceof FormData) && !Object.keys(headers).some((k) => k.toLowerCase() === "content-type")) {
		headers["Content-Type"] = "application/json";
	}
	if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
		headers["X-CSRF-Token"] = await ensureCsrfToken();
	}
	const r = await fetch(API + path, {
		...opts,
		method,
		credentials: "include",
		headers,
	});
	const d = await r.json().catch(() => ({ error: "Invalid server response." }));
	if (!r.ok) {
		if (r.status === 403 && /CSRF/i.test(String(d.error || ""))) csrfToken = "";
		throw new Error(d.error || "Request failed");
	}
	return d;
}
const money = (n) =>
	"$" +
	new Intl.NumberFormat("en-US", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(Number(n || 0));
const fallbackGames = [
	["Gates of Olympus", "GatesofOlympus.jpg"],
	["Sweet Bonanza", "SweetBonanza.jpg"],
	["Starlight Princess", "StarlightPrincess.jpg"],
	["Aztec Gems Deluxe", "AztecGemsDeluxe.jpg"],
	["Starlight Christmas", "StarlightChristmas.jpg"],
	["Big Bass Bonanza", "BigBassBonanza.jpg"],
	["Bonanza Gold", "BonanzaGold.jpg"],
	["Age of Gods: King of Olympus", "AgeOfGodsKingofOlympusPT.jpg"],
	["Dragon Champions", "DragonChampionsPT.jpg"],
	["Bull Stampede", "BullStampedeKA.jpg"],
].map(([title, file], i) => ({
	id: i + 1,
	title,
	slug: title.toLowerCase().replaceAll(" ", "-"),
	provider: "Game Provider",
	category: "Slots",
	image: "/legacy-assets/frontend/Default/ico/" + file,
	status: "active",
}));
const PROVIDER_TITLE_TOKENS =
	/^(?:bgm|bgaming|egt|egtd|egt\s*digital|hsg|hacksaw|ntn|netent|nt|pgsoft|pg|pp|pragmatic|novomatic|habanero)[\s_-]+/i;
const PROVIDER_TITLE_SUFFIX =
	/(?:[\s_-]*(?:pragmatic\s*play|pragmatic|bgaming|bgm|egt\s*digital|egtd|egt|hacksaw\s*gaming|hacksaw|hsg|netent|ntn|novomatic|habanero|pg\s*soft|pgsoft|pg))$/i;
const TITLE_WORDS = [
	"hold and win",
	"hold and spin",
	"hold and respin",
	"ways",
	"megaways",
	"wilds",
	"wild",
	"bonus",
	"deluxe",
	" deluxe",
	"gold",
	"gems",
	"jungle",
	"fortune",
	"dragon",
	"phoenix",
	"princess",
	"olympus",
	"christmas",
	"mahjong",
	"ways",
	"monkey",
	"monkeys",
	"lucky",
	"luck",
	"fruits",
	"fruit",
	"alien",
	"clover",
	"burning",
	"blazing",
	"fire",
	"pot",
	"pots",
	"spin",
	"reels",
	"book",
	"of",
	"the",
	"and",
	"king",
	"queen",
	"treasure",
	"island",
	"magic",
	"mystery",
	"casino",
	"cash",
	"hit",
	"super",
	"mega",
	"grand",
	"diamond",
	"diamonds",
	"blitz",
	"drop",
	"storm",
	"thunder",
	"lightning",
	"gates",
	"aztec",
	"gem",
	"sugar",
	"sweet",
	"bonanza",
	"big",
	"bass",
	"river",
	"golden",
	"wild",
	"west",
	"cursed",
	"chest",
	"chests",
	"knight",
	"rider",
	"star",
	"light",
	"always",
	"up",
	"x",
	"win",
	"free",
	"spins",
	"ways",
	"quest",
	"reloaded",
	"rising",
	"jackpot",
	"express",
	"party",
	"rush",
	"run",
	"mania",
	"fortune",
	"nights",
	"night",
	"cash",
	"multiplier",
	"multiplied",
	"wilds",
	"royal",
	"royals",
	"goddess",
	"gods",
	"versus",
	"vs",
	"empire",
	"empres",
	"golden",
	"legacy",
	"reel",
	"reels",
	"bonus",
	"buy",
];
function resolveBundledGameAsset(game) {
	const normalize = (value) => String(value || "").toLowerCase().replace(/[™®©]/g, "").replace(/[^a-z0-9]/g, "");
	const slug = normalize(game?.slug);
	const title = normalize(game?.title);
	// Explicitly reject editions whose assets are not included in this project.
	if (/(?:1000|xmas|christmasedition|dice|superscatter|pachi|megaways|deluxeedition)/.test(slug)) return null;
	const stripProvider = (value) => value
		.replace(/^(?:pragmaticplay|pragmatic|pgsoft|pg|bgaming|bgm|egtdigital|egtd|egt|hacksawgaming|hacksaw|hsg|netent|ntn|novomatic|habanero)/, "")
		.replace(/(?:pragmaticplay|pragmatic|pgsoft|bgaming|egtdigital|hacksawgaming|netent|novomatic|habanero)$/, "")
		.replace(/tm$/, "");
	const canonicalSlug = stripProvider(slug.replace(/^(?:pragmaticplay|pragmatic|pgsoft|bgaming|egtdigital|hacksawgaming|netent|novomatic|habanero)/, ""));
	const canonicalTitle = stripProvider(title);
	if (canonicalSlug === "gatesofolympus" || canonicalTitle === "gatesofolympus") return "GatesofOlympus";
	if (canonicalSlug === "starlightprincess" || canonicalTitle === "starlightprincess") return "StarlightPrincess";
	if (canonicalSlug === "starlightchristmas" || canonicalTitle === "starlightchristmas") return "StarlightChristmas";
	if (canonicalSlug === "aztecgemsdeluxe" || canonicalTitle === "aztecgemsdeluxe") return "AztecGemsDeluxe";
	return null;
}

function formatGameTitle(game) {
	const original = String(game?.title || "").trim();
	const imageName = String(game?.image || "")
		.split("/")
		.pop()
		.replace(/\.[^.]+$/, "")
		.replace(/%20/gi, " ");
	let value =
		(imageName && /[A-Z]/.test(imageName) ? imageName : original) ||
		imageName;
	value = value
		.replace(/[\s_-]+/g, " ")
		.trim()
		.replace(PROVIDER_TITLE_TOKENS, "")
		.replace(PROVIDER_TITLE_SUFFIX, "")
		.trim();
	value = value
		.replace(
			/\b(?:thumb(?:nail)?|ico|icon|desktop|mobile|copy|final)\b/gi,
			" ",
		)
		.replace(/\s+\d+(?:\s+\d+){1,3}$/, "")
		.replace(/([a-z])([A-Z])/g, "$1 $2")
		.replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
		.replace(/^(\d+)([A-Za-z])/, "$1 $2")
		.replace(/([A-Za-z])([0-9]+)/g, "$1 $2")
		.replace(/\s+/g, " ")
		.trim();
	// Filenames are often concatenated. Split recognizable game-title words without changing identifiers.
	const lower = value
		.toLowerCase()
		.replace(/[^a-z0-9 ]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
	if (!lower) return original || "Untitled Game";
	const parts = lower.split(" ");
	const out = [];
	for (const part of parts) {
		if (/^\d+$/.test(part)) {
			out.push(part);
			continue;
		}
		let rest = part,
			words = [];
		while (rest) {
			let match = TITLE_WORDS.filter(
				(w) => w.trim().length > 1 && rest.startsWith(w.trim()),
			).sort((a, b) => b.trim().length - a.trim().length)[0];
			if (match) {
				words.push(match.trim());
				rest = rest.slice(match.trim().length);
			} else {
				words.push(rest);
				rest = "";
			}
		}
		out.push(...words);
	}
	const result = out.join(" ").replace(/\s+/g, " ").trim();
	return result
		.replace(/\b\w/g, (c) => c.toUpperCase())
		.replace(/\bX\s+(\d+)/g, "x$1")
		.replace(/\bOf\b/g, "of")
		.replace(/\bAnd\b/g, "and")
		.replace(/\bThe\b/g, "the");
}
function App() {
	const moneyRequestKeys = useRef({});
	const [sidebarCollapsed, setSidebarCollapsed] = useState(false),
		[mobileSidebarOpen, setMobileSidebarOpen] = useState(false),
		[activeGame, setActiveGame] = useState(null),
		[pendingGame, setPendingGame] = useState(null),
		[user, setUser] = useState(null),
		[wallet, setWallet] = useState({ balance: 0, currency: "USD" }),
		[games, setGames] = useState([]),
		[favorites, setFavorites] = useState([]),
		[transactions, setTransactions] = useState([]),
		[gameHistory, setGameHistory] = useState([]),
		[page, setPage] = useState("Lobby"),
		[modal, setModal] = useState(""),
		[busy, setBusy] = useState(false),
		[error, setError] = useState(""),
		[notice, setNotice] = useState(""),
		[search, setSearch] = useState(""),
		[category, setCategory] = useState("Slots"),
		[providerFilter, setProviderFilter] = useState("All Providers"),
		[providers, setProviders] = useState([]),
		[adminGames, setAdminGames] = useState([]),
		[gameEdit, setGameEdit] = useState(null),
		[banners, setBanners] = useState([]),
		[adminBanners, setAdminBanners] = useState([]),
		[settingsSlug, setSettingsSlug] = useState("gates-of-olympus"),
		[gameSettings, setGameSettings] = useState(null),
		[settingsBets, setSettingsBets] = useState(
			"0.01,0.02,0.05,0.10,0.25,0.50,1,2,5",
		),
		[bannerIndex, setBannerIndex] = useState(0),
		[amount, setAmount] = useState("25.00"),
		[note, setNote] = useState(""),
		[adminData, setAdminData] = useState({
			summary: null,
			transactions: [],
			users: [],
			gameHistory: [],
		}),
		[depositMethods, setDepositMethods] = useState([]),
		[depositMethodId, setDepositMethodId] = useState(""),
		[adminDepositMethods, setAdminDepositMethods] = useState([]),
		[walletRefreshing, setWalletRefreshing] = useState(false),
		[missingGameTitle, setMissingGameTitle] = useState(""),
		[catalogLimit, setCatalogLimit] = useState(48);
	const featuredGames = useMemo(
		() =>
			games
				.filter((g) => Number(g.featured) === 1 || g.featured === true)
				.slice(0, 7),
		[games],
	);
	const filtered = useMemo(() => {
		let source =
			page === "Lobby"
				? featuredGames
				: page === "Favorites"
					? games.filter((g) => favorites.includes(Number(g.id)))
					: page === "New Games"
						? games.filter(
								(g) =>
									Number(g.is_new) === 1 || g.is_new === true,
							)
						: games;
		return source.filter(
			(g) =>
				(page === "Lobby" ||
					page === "New Games" ||
					category === "Lobby" ||
					g.category === category) &&
				(page === "Lobby" ||
					!providerFilter ||
					providerFilter === "All Providers" ||
					g.provider === providerFilter) &&
				g.title.toLowerCase().includes(search.toLowerCase()),
		);
	}, [
		games,
		featuredGames,
		page,
		category,
		providerFilter,
		search,
		favorites,
	]);
	const visibleGames = useMemo(
		() => filtered.slice(0, page === "Lobby" ? 7 : catalogLimit),
		[filtered, page, catalogLimit],
	);
	useEffect(() => {
		setCatalogLimit(48);
	}, [page, category, providerFilter, search]);
	async function refresh() {
		try {
			const d = await api("/auth/me");
			if (!d.authenticated || !d.user) {
				setUser(null);
				setWallet({ balance: 0, currency: "USD" });
				setTransactions([]);
				setGameHistory([]);
				setFavorites([]);
				return;
			}
			setUser(d.user);
			setWallet(d.wallet || { balance: 0, currency: "USD" });
			const t = await api("/transactions");
			setTransactions(t.transactions || []);
			const f = await api("/favorites");
			setFavorites((f.favorites || []).map((x) => Number(x.game_id)));
			try {
				const gh = await api("/game-history");
				setGameHistory(gh.history || []);
			} catch {
				setGameHistory([]);
			}
		} catch {
			setUser(null);
			setWallet({ balance: 0, currency: "USD" });
			setTransactions([]);
			setGameHistory([]);
			setFavorites([]);
		}
	}
	async function openGame(g) {
		if (!g) return;
		const assetGame = resolveBundledGameAsset(g);
		const supported = Boolean(assetGame);
		if (!supported) {
			setMissingGameTitle(g.title || "Game");
			setModal("game-assets");
			return;
		}
		if (!user) {
			setPendingGame(g);
			setModal("login");
			setError("Please sign in before playing.");
			return;
		}
		setBusy(true);
		try {
			const sessionId =
				window.crypto && typeof window.crypto.randomUUID === "function"
					? window.crypto.randomUUID()
					: "zyv-" +
						Date.now().toString(36) +
						"-" +
						Math.random().toString(36).slice(2);
			const launchGame = { ...g, sessionId };
			const check = await verifyGameAssets(launchGame);
			if (!check.ok) {
				setMissingGameTitle(g.title || "Game");
				setError("");
				setModal("game-assets");
				return;
			}
			try {
				await api("/game-history", {
					method: "POST",
					body: JSON.stringify({
						session_id: sessionId,
						game_id: Number(g.id) || null,
						slug: String(g.slug || ""),
						title: String(g.title || "Unknown game"),
						provider: String(g.provider || "Unknown provider"),
					}),
				});
				const history = await api("/game-history");
				setGameHistory(history.history || []);
			} catch (historyError) {
				console.warn(
					"Game history could not be saved:",
					historyError.message,
				);
			}
			setActiveGame(launchGame);
			setMobileSidebarOpen(false);
		} catch {
			setMissingGameTitle(g.title || "Game");
			setError("");
			setModal("game-assets");
		} finally {
			setBusy(false);
		}
	}
	function buildGameAssetUrl(active) {
		const mobile =
			window.matchMedia("(max-width: 820px)").matches ||
			/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
		const game = resolveBundledGameAsset(active);
		if (!game) return "";
		const folder = game === "GatesofOlympus"
			? (mobile ? "GatesofOlympusM" : "GatesofOlympus")
			: game === "StarlightPrincess"
				? (mobile ? "StarlightPrincessM" : "StarlightPrincess")
				: game === "StarlightChristmas"
					? (mobile ? "StarlightChristmasM" : "StarlightChristmas")
					: (mobile ? "AztecGemsDeluxeM" : "AztecGemsDeluxe");
		const sessionId =
			active?.sessionId ||
			window.__zyvalleGameSessionId ||
			(window.__zyvalleGameSessionId =
				window.crypto && typeof window.crypto.randomUUID === "function"
					? window.crypto.randomUUID()
					: "zyv-" +
						Date.now().toString(36) +
						"-" +
						Math.random().toString(36).slice(2));
		const assetBase = (
			import.meta.env.VITE_GAME_ASSET_BASE_URL || window.location.origin
		).replace(/\/$/, "");
		const assetParam =
			game !== "GatesofOlympus"
				? "&assetBase=" + encodeURIComponent(assetBase)
				: "";
		return (
			"/legacy-assets/games/" +
			folder +
			"/gs2c/html5Game.html?lang=en&cur=USD&sessionId=" +
			encodeURIComponent(sessionId) +
			assetParam
		);
	}
	function gameAssetUrl() {
		return buildGameAssetUrl(activeGame);
	}
	async function verifyGameAssets(g) {
		const url = new URL(buildGameAssetUrl(g), window.location.origin);
		const htmlResponse = await fetch(url.href, { cache: "no-store" });
		if (!htmlResponse.ok) return { ok: false };
		const html = await htmlResponse.text();
		if (
			!html ||
			/<div[^>]+id=["']root["']/.test(html) ||
			/\/src\/main\.(jsx|tsx?)/i.test(html)
		)
			return { ok: false };
		const scriptRefs = [
			...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi),
		]
			.map((m) => m[1])
			.filter((s) => /\.js(?:[?#]|$)/i.test(s))
			.slice(0, 8);
		if (!scriptRefs.length) return { ok: false };
		for (const ref of scriptRefs) {
			const src = new URL(ref, url.href);
			const r = await fetch(src.href, { cache: "no-store" });
			if (!r.ok) return { ok: false };
			const body = await r.text();
			if (
				!body ||
				/^\s*<!doctype html/i.test(body) ||
				/<html[^>]*>\s*<head/i.test(body)
			)
				return { ok: false };
		}
		return { ok: true };
	}
	async function loadGameHistory() {
		if (!user) {
			setGameHistory([]);
			return;
		}
		try {
			const d = await api("/game-history");
			setGameHistory(d.history || []);
		} catch (e) {
			setNotice("Game history could not be loaded: " + e.message);
		}
	}
	async function loadDepositMethods() {
		try {
			const d = await api("/deposit-methods");
			const methods = d.methods || [];
			setDepositMethods(methods);
			setDepositMethodId((current) =>
				methods.some((m) => String(m.id) === String(current))
					? String(current)
					: methods[0]
						? String(methods[0].id)
						: "",
			);
		} catch (e) {
			setDepositMethods([]);
			setNotice("Deposit methods could not be loaded: " + e.message);
		}
	}
	async function openDeposit() {
		setError("");
		setNote("");
		setAmount("25.00");
		await loadDepositMethods();
		setModal("deposit");
	}
	async function refreshWallet() {
		if (!user) return;
		setWalletRefreshing(true);
		try {
			const d = await api("/wallet");
			setWallet(d.wallet || { balance: 0, currency: "USD" });
			setNotice("Wallet balance refreshed.");
		} catch (e) {
			setNotice(e.message || "Wallet refresh failed.");
		} finally {
			setWalletRefreshing(false);
		}
	}
	async function toggleFavorite(g, e) {
		e?.stopPropagation?.();
		if (!user) {
			setModal("login");
			setError("Please sign in to save favorite games.");
			return;
		}
		const id = Number(g.id);
		const exists = favorites.includes(id);
		try {
			if (exists) {
				await api("/favorites/" + id, { method: "DELETE" });
				setFavorites((prev) => prev.filter((x) => x !== id));
				setNotice("Game removed from favorites.");
			} else {
				await api("/favorites", {
					method: "POST",
					body: JSON.stringify({ game_id: id }),
				});
				setFavorites((prev) =>
					prev.includes(id) ? prev : [...prev, id],
				);
				setNotice("Game added to favorites.");
			}
		} catch (err) {
			setNotice(err.message || "Could not update favorites.");
		}
	}
	async function loadGames() {
		const normalize = (v) =>
			String(v || "")
				.trim()
				.toLocaleLowerCase()
				.replace(/[^a-z0-9]+/g, "");
		try {
			const d = await api("/games?category=");
			const dbGames = [];
			const seen = new Set();
			for (const g of d.games || []) {
				const key = normalize(g.title) + "::" + normalize(g.provider);
				if (!key || seen.has(key)) continue;
				seen.add(key);
				const normalized = {
					...g,
					image: g.image_path || g.image,
					featured: Number(g.featured) === 1 || g.featured === true,
					is_new: Number(g.is_new) === 1 || g.is_new === true,
					catalogOnly: false,
				};
				dbGames.push(normalized);
			}
			if (!dbGames.length) {
				setGames([]);
				setNotice("Database catalog is empty. Import server/catalog-assets-migration-clean-names.sql to register the full game catalog.");
				return;
			}
			// The database is the source of truth: favorites, game settings, admin flags,
			// and play history all depend on the database game ID/slug.
			setGames(dbGames);
		} catch (e) {
			// Artwork-only fallback is used only while the API/database is unreachable.
			setNotice("Could not reach the database game catalog; showing artwork-only fallback games.");
			setGames(ASSET_GAME_CATALOG.map((g) => ({ ...g, title: formatGameTitle(g) })));
		}
	}
	async function loadProviders() {
		try {
			const d = await api("/providers");
			setProviders(d.providers || []);
		} catch {
			setProviders([]);
		}
	}
	async function loadBanners() {
		try {
			const d = await api("/banners");
			setBanners(d.banners || []);
		} catch {
			setBanners([]);
		}
	}
	async function openBannerManagement() {
		try {
			const d = await api("/admin/banners");
			setAdminBanners(d.banners || []);
			setPage("Banner Management");
		} catch (e) {
			setNotice(e.message);
		}
	}
	async function uploadBanner(e) {
		e.preventDefault();
		const form = e.currentTarget;
		const fd = new FormData(form);
		try {
			setBusy(true);
			const token = await ensureCsrfToken();
			const r = await fetch(API + "/admin/banners", {
				method: "POST",
				credentials: "include",
				headers: { "X-CSRF-Token": token },
				body: fd,
			});
			const d = await r
				.json()
				.catch(() => ({ error: "Invalid server response." }));
			if (!r.ok) throw new Error(d.error || "Upload failed");
			form.reset();
			await loadBanners();
			const a = await api("/admin/banners");
			setAdminBanners(a.banners || []);
			setNotice("Banner added successfully.");
		} catch (err) {
			setNotice(err.message);
		} finally {
			setBusy(false);
		}
	}
	async function deleteBanner(id) {
		if (!window.confirm("Delete this banner?")) return;
		try {
			await api("/admin/banners/" + id, { method: "DELETE" });
			await loadBanners();
			const a = await api("/admin/banners");
			setAdminBanners(a.banners || []);
			setNotice("Banner deleted.");
		} catch (e) {
			setNotice(e.message);
		}
	}
	async function toggleBanner(id, active) {
		try {
			await api("/admin/banners/" + id, {
				method: "PATCH",
				body: JSON.stringify({ active: !active }),
			});
			await loadBanners();
			const a = await api("/admin/banners");
			setAdminBanners(a.banners || []);
		} catch (e) {
			setNotice(e.message);
		}
	}
	useEffect(() => {
		refresh();
		loadGames();
		loadProviders();
		loadBanners();
		loadDepositMethods();
	}, []);
	useEffect(() => {
		if (banners.length < 2) return;
		const t = setInterval(
			() => setBannerIndex((i) => (i + 1) % banners.length),
			5000,
		);
		return () => clearInterval(t);
	}, [banners.length]);
	useEffect(() => {
		if (bannerIndex >= banners.length) setBannerIndex(0);
	}, [banners.length, bannerIndex]);
	useEffect(() => {
		if (notice) {
			const t = setTimeout(() => setNotice(""), 3500);
			return () => clearTimeout(t);
		}
	}, [notice]);
	async function authSubmit(e) {
		e.preventDefault();
		setBusy(true);
		setError("");
		const fd = new FormData(e.currentTarget);
		try {
			const d = await api(
				"/auth/" + (modal === "register" ? "register" : "login"),
				{
					method: "POST",
					body: JSON.stringify(Object.fromEntries(fd)),
				},
			);
			setUser(d.user);
			setModal("");
			setNotice("Welcome to Zyvalle Bet.");
			const gameToOpen = pendingGame;
			setPendingGame(null);
			refresh();
			if (gameToOpen) setTimeout(() => openGame(gameToOpen), 0);
		} catch (e) {
			setError(e.message);
		} finally {
			setBusy(false);
		}
	}
	async function logout() {
		await api("/auth/logout", { method: "POST" }).catch(() => {});
		setUser(null);
		setActiveGame(null);
		setPendingGame(null);
		setPage("Lobby");
		setNotice("You have been signed out.");
	}
	async function requestMoney(type) {
		setError("");
		setBusy(true);
		const payload = {
			amount: Number(amount),
			note,
			...(type === "deposit" ? { method_id: Number(depositMethodId) } : {}),
		};
		const signature = JSON.stringify({ type, ...payload });
		if (!moneyRequestKeys.current[type] || moneyRequestKeys.current[type].signature !== signature) {
			moneyRequestKeys.current[type] = {
				signature,
				key: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`,
			};
		}
		try {
			const d = await api("/wallet/" + type + "-request", {
				method: "POST",
				headers: { "Idempotency-Key": moneyRequestKeys.current[type].key },
				body: JSON.stringify(payload),
			});
			delete moneyRequestKeys.current[type];
			setNotice(d.message);
			setModal("");
			setNote("");
			await refresh();
		} catch (e) {
			setError(e.message);
		} finally {
			setBusy(false);
		}
	}
	async function openAdmin() {
		try {
			const [s, t, u, gh] = await Promise.all([
				api("/admin/summary"),
				api("/admin/transactions"),
				api("/admin/users"),
				api("/admin/game-history"),
			]);
			setAdminData({
				summary: s,
				transactions: t.transactions,
				users: u.users,
				gameHistory: gh.history || [],
			});
			setPage("Admin");
		} catch (e) {
			setNotice(e.message);
		}
	}
	async function openDepositSettings() {
		try {
			const d = await api("/admin/deposit-methods");
			setAdminDepositMethods(d.methods || []);
			setPage("Deposit Settings");
		} catch (e) {
			setNotice(e.message);
		}
	}
	async function updateDepositMethod(id, changes) {
		try {
			await api("/admin/deposit-methods/" + id, {
				method: "PATCH",
				body: JSON.stringify(changes),
			});
			const d = await api("/admin/deposit-methods");
			setAdminDepositMethods(d.methods || []);
			await loadDepositMethods();
			setNotice("Deposit settings saved.");
		} catch (e) {
			setNotice(e.message);
		}
	}
	async function openGameManagement() {
		try {
			const d = await api("/admin/games");
			setAdminGames(d.games || []);
			setPage("Game Management");
		} catch (e) {
			setNotice(e.message);
		}
	}
	async function openProviderManagement() {
		try {
			const d = await api("/admin/providers");
			setProviders(d.providers || []);
			setPage("Provider Management");
		} catch (e) {
			setNotice(e.message);
		}
	}
	async function toggleProvider(provider, active) {
		try {
			await api("/admin/providers/" + encodeURIComponent(provider), {
				method: "PATCH",
				body: JSON.stringify({ active: !active }),
			});
			await openProviderManagement();
			await loadProviders();
			await loadGames();
			setNotice("Provider status updated.");
		} catch (e) {
			setNotice(e.message);
		}
	}
	async function openGameSettings(slug = "gates-of-olympus") {
		try {
			const d = await api("/admin/games");
			const rows = d.games || [];
			setAdminGames(rows);
			const chosen = slug || rows[0]?.slug || "gates-of-olympus";
			setSettingsSlug(chosen);
			const s = await api(
				"/admin/games/" + encodeURIComponent(chosen) + "/settings",
			);
			setGameSettings(s.settings);
			setSettingsBets((s.settings.allowedCoinBets || []).join(","));
			setPage("Game Settings");
		} catch (e) {
			setNotice(e.message);
		}
	}
	async function changeSettingsGame(slug) {
		setSettingsSlug(slug);
		setGameSettings(null);
		try {
			const d = await api(
				"/admin/games/" + encodeURIComponent(slug) + "/settings",
			);
			setGameSettings(d.settings);
			setSettingsBets((d.settings.allowedCoinBets || []).join(","));
		} catch (e) {
			setNotice(e.message);
		}
	}
	async function saveGameSettings(e) {
		e.preventDefault();
		if (!gameSettings) return;
		try {
			setBusy(true);
			const bets = settingsBets
				.split(",")
				.map((v) => Number(v.trim()))
				.filter(Number.isFinite);
			const payload = { ...gameSettings, allowedCoinBets: bets };
			const d = await api(
				"/admin/games/" +
					encodeURIComponent(settingsSlug) +
					"/settings",
				{ method: "PATCH", body: JSON.stringify(payload) },
			);
			setGameSettings(d.settings);
			setSettingsBets((d.settings.allowedCoinBets || []).join(","));
			setNotice("Game settings saved successfully.");
		} catch (e) {
			setNotice(e.message);
		} finally {
			setBusy(false);
		}
	}
	async function saveGame(id, changes) {
		try {
			await api("/admin/games/" + id, {
				method: "PATCH",
				body: JSON.stringify(changes),
			});
			await loadGames();
			const d = await api("/admin/games");
			setAdminGames(d.games || []);
			setGameEdit(null);
			setNotice("Game updated successfully.");
		} catch (e) {
			setNotice(e.message);
		}
	}
	async function review(id, decision) {
		try {
			await api("/admin/transactions/" + id + "/review", {
				method: "POST",
				body: JSON.stringify({ decision }),
			});
			await openAdmin();
			setNotice("Transaction updated successfully.");
		} catch (e) {
			setNotice(e.message);
		}
	}
	const gameCard = (g) => (
		<div
			className="game-card"
			key={g.id || g.slug}
			role="button"
			tabIndex={0}
			onClick={() => openGame(g)}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					openGame(g);
				}
			}}
		>
			<div className="game-art">
				<img
					loading="lazy"
					decoding="async"
					src={
						g.image?.startsWith("/")
							? g.image
							: "/legacy-assets/" + g.image
					}
					alt={g.title + " game artwork"}
					onError={(e) => {
						e.currentTarget.style.display = "none";
					}}
				/>
				{g.rtp_percent != null &&
					Number.isFinite(Number(g.rtp_percent)) && (
						<span
							className={
								"rtp-overlay " +
								(Number(g.rtp_percent) > 90
									? "rtp-high"
									: Number(g.rtp_percent) >= 70
										? "rtp-medium"
										: "rtp-low")
							}
							title="Configured RTP target, not live measured payout"
						>
							RTP {Number(g.rtp_percent).toFixed(2)}%
						</span>
					)}
				<div className="game-card-actions">
					{(g.featured || g.is_new) && (
						<span
							className={
								"hot " + (g.is_new && !g.featured ? "new" : "")
							}
						>
							{g.featured ? "HOT" : "NEW"}
						</span>
					)}
					{(
						<button
							type="button"
							aria-label={"Favorite " + g.title}
							title={favorites.includes(Number(g.id)) ? "Remove from favorites" : "Add to favorites"}
							onClick={(e) => toggleFavorite(g, e)}
							aria-pressed={favorites.includes(Number(g.id))}
							disabled={Boolean(g.catalogOnly)}
							className={
								"favorite " +
								(favorites.includes(Number(g.id)) ? "is-favorite" : "")
							}
						>
							<Heart
								size={14}
								fill={favorites.includes(Number(g.id)) ? "currentColor" : "none"}
							/>
						</button>
					)}
				</div>
				<div className="play-overlay">
					<span>
						PLAY NOW <ArrowUpRight size={14} />
					</span>
				</div>
				<div className="game-meta-overlay">
					<div className="game-title">{g.title}</div>
					<div className="provider">
						{g.provider || "GAME PROVIDER"}
					</div>
				</div>
			</div>
		</div>
	);
	return (
		<>
			<header className="topbar">
				<button
					className="icon-btn menu"
					aria-label={
						sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
					}
					title={
						sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
					}
					onClick={() => {
						if (window.matchMedia("(max-width: 820px)").matches) {
							setMobileSidebarOpen((v) => !v);
						} else {
							setSidebarCollapsed((v) => !v);
						}
					}}
				>
					<Menu size={18} />
				</button>
				<button className="brand" onClick={() => setPage("Lobby")}>
					ZYVALLE<span>BET</span>
				</button>
				<div className="top-actions">
					<label className="searchbox">
						<Search size={16} />
						<input
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder="Search games..."
						/>
					</label>
					{user && (
						<>
							<button
								className="balance"
								onClick={() => setModal("wallet")}
							>
								<Wallet size={15} />
								{money(wallet.balance)}
							</button>
							<button
								type="button"
								className="icon-btn wallet-refresh-btn"
								title="Refresh wallet balance"
								aria-label="Refresh wallet balance"
								onClick={refreshWallet}
								disabled={walletRefreshing}
							>
								<RefreshCw
									size={15}
									className={walletRefreshing ? "spin" : ""}
								/>
							</button>
						</>
					)}
					<button
						className="icon-btn"
						onClick={() =>
							setNotice(
								"Live chat akan tersedia setelah konfigurasi support.",
							)
						}
					>
						<MessageSquare size={17} />
					</button>
					{user ? (
						<>
							<button
								className="user-pill"
								onClick={() => setPage("Dashboard")}
							>
								<UserRound size={15} />
								{user.name.split(" ")[0]}
							</button>
							<button
								className="icon-btn logout-mobile"
								title="Logout"
								aria-label="Logout"
								onClick={logout}
							>
								<LogOut size={16} />
							</button>
						</>
					) : (
						<>
							<button
								className="login-btn"
								onClick={() => {
									setModal("login");
									setError("");
								}}
							>
								LOGIN
							</button>
							<button
								className="register-btn"
								onClick={() => {
									setModal("register");
									setError("");
								}}
							>
								REGISTER
							</button>
						</>
					)}
				</div>
			</header>
			<div
				className={
					"layout " +
					(sidebarCollapsed ? "sidebar-collapsed" : "") +
					(mobileSidebarOpen ? " mobile-sidebar-open" : "")
				}
			>
				{mobileSidebarOpen && (
					<button
						className="sidebar-backdrop"
						aria-label="Close navigation"
						onClick={() => setMobileSidebarOpen(false)}
					/>
				)}
				<aside className="sidebar">
					<div className="promo-mini">
						<small>ZYVALLE EXCLUSIVE</small>
						<strong>
							YOUR GAME.
							<br />
							YOUR MOMENT.
						</strong>
						<span>
							ENTER THE LOBBY <ArrowUpRight size={12} />
						</span>
					</div>
					<div className="side-label">GAMES</div>
					{[
						["Lobby", LayoutDashboard],
						["Slots", Gamepad2],
						["Favorites", Heart],
						["New Games", Flame],
					].map(([n, I]) => (
						<button
							key={n}
							className={
								"side-link " + (page === n ? "active" : "")
							}
							onClick={() => {
								setMobileSidebarOpen(false);
								setPage(n);
								if (n === "Lobby")
									setProviderFilter("All Providers");
								setCategory(
									n === "Lobby"
										? "Lobby"
										: n === "Slots"
											? "Slots"
											: n === "New Games"
												? "New Games"
												: "Slots",
								);
							}}
						>
							<I size={16} />
							{n}
						</button>
					))}
					<div className="side-label">ACCOUNT</div>
					{user ? (
						[
							["Wallet", Wallet],
							["Transactions", History],
							["Game History", Gamepad2],
							["Rewards", Gift],
						].map(([n, I]) => (
							<button
								key={n}
								className={
									"side-link " + (page === n ? "active" : "")
								}
								onClick={() => {
									setMobileSidebarOpen(false);
									setPage(n);
									if (n === "Transactions")
										api("/transactions")
											.then((d) =>
												setTransactions(d.transactions),
											)
											.catch(() => {});
									if (n === "Game History") loadGameHistory();
								}}
							>
								<I size={16} />
								{n}
							</button>
						))
					) : (
						<>
							<button
								className="side-link"
								onClick={() => {
									setModal("login");
									setError("");
								}}
							>
								<UserRound size={16} />
								Login
							</button>
							<button
								className="side-link"
								onClick={() => {
									setModal("register");
									setError("");
								}}
							>
								<Plus size={16} />
								Create account
							</button>
						</>
					)}
					{user?.role === "admin" && (
						<button
							className={
								"side-link " +
								(page === "Admin" ? "active" : "")
							}
							onClick={openAdmin}
						>
							<ShieldCheck size={16} />
							Admin Panel
						</button>
					)}
					<div className="sidebar-bottom">
						<div className="safe">
							<ShieldCheck size={16} />
							<span>
								<b>PLAY RESPONSIBLY</b>
								<small>Stay in control</small>
							</span>
						</div>
						<small className="version">ZYVALLE BET · v1.0</small>
					</div>
				</aside>
				<main className="main">
					<nav className="mobile-tabs" aria-label="Mobile navigation">
						<button
							className={page === "Lobby" ? "active" : ""}
							onClick={() => {
								setPage("Lobby");
								setCategory("Lobby");
								setProviderFilter("All Providers");
							}}
						>
							<LayoutDashboard size={18} />
							<span>Lobby</span>
						</button>
						<button
							className={page === "Slots" ? "active" : ""}
							onClick={() => {
								setPage("Slots");
								setCategory("Slots");
							}}
						>
							<Gamepad2 size={18} />
							<span>Slots</span>
						</button>
						<button
							className={
								[
									"Wallet",
									"Transactions",
									"Dashboard",
								].includes(page) || modal === "login"
									? "active"
									: ""
							}
							onClick={() =>
								user ? setPage("Dashboard") : setModal("login")
							}
						>
							<UserRound size={18} />
							<span>{user ? "Account" : "Login"}</span>
						</button>
					</nav>
					{page === "Lobby" ||
					page === "Slots" ||
					page === "New Games" ||
					page === "Favorites" ? (
						<>
							<section
								className="banner-slider"
								aria-label="Promotional banners"
							>
								{banners.length > 0 ? (
									<>
										<a
											className="banner-slide"
											href={
												banners[bannerIndex]
													?.link_url || "#"
											}
											onClick={(e) => {
												if (
													!banners[bannerIndex]
														?.link_url ||
													banners[bannerIndex]
														.link_url === "#"
												)
													e.preventDefault();
											}}
											aria-label="Open banner destination"
										>
											<img
												src={
													banners[bannerIndex]
														?.image_url
												}
												alt=""
											/>
										</a>
										{banners.length > 1 && (
											<>
												<button
													className="banner-arrow prev"
													aria-label="Previous banner"
													onClick={() =>
														setBannerIndex(
															(i) =>
																(i -
																	1 +
																	banners.length) %
																banners.length,
														)
													}
												>
													<ChevronLeft size={18} />
												</button>
												<button
													className="banner-arrow next"
													aria-label="Next banner"
													onClick={() =>
														setBannerIndex(
															(i) =>
																(i + 1) %
																banners.length,
														)
													}
												>
													<ChevronRight size={18} />
												</button>
												<div className="banner-dots">
													{banners.map((b, i) => (
														<button
															key={b.id}
															aria-label={
																"Show banner " +
																(i + 1)
															}
															className={
																i ===
																bannerIndex
																	? "active"
																	: ""
															}
															onClick={() =>
																setBannerIndex(
																	i,
																)
															}
														/>
													))}
												</div>
											</>
										)}
									</>
								) : (
									<div className="banner-empty">
										<ImagePlus size={22} />
										<span>Promotional banner</span>
									</div>
								)}
							</section>
							<div className="category-pills">
								{[
									["Lobby", "⌂"],
									["Slots", "♜"],
									["New Games", "✦"],
								].map(([n, ic]) => (
									<button
										key={n}
										className={page === n ? "chosen" : ""}
										onClick={() => {
											setCategory(n);
											setPage(n);
										}}
									>
										{ic} <span>{n.toUpperCase()}</span>
									</button>
								))}
							</div>
							<section className="content-section">
								<div className="section-head">
									<div>
										<h2>
											{search
												? "SEARCH RESULTS"
												: page === "New Games"
													? "NEW GAMES"
													: page === "Favorites"
														? "YOUR FAVORITES"
														: page === "Lobby"
															? "FEATURED GAMES"
															: page === "Slots"
																? "ALL SLOTS"
																: page.toUpperCase()}
										</h2>
										<small>{filtered.length} GAMES</small>
									</div>
									<button
										className="view-all"
										onClick={() => {
											setCategory("Slots");
											setProviderFilter("All Providers");
											setPage("Slots");
										}}
									>
										VIEW ALL <ArrowUpRight size={14} />
									</button>
								</div>
								{page === "Slots" && (
									<div className="provider-filter">
										<label>
											PROVIDER{" "}
											<select
												value={providerFilter}
												onChange={(e) =>
													setProviderFilter(
														e.target.value,
													)
												}
											>
												<option>All Providers</option>
												{ASSET_PROVIDER_CATALOG.map(
													(p) => (
														<option
															key={p.provider}
															value={p.provider}
														>
															{p.provider} (
															{p.gameCount})
														</option>
													),
												)}
											</select>
										</label>
										<span>{filtered.length} games</span>
									</div>
								)}
								{filtered.length ? (
									<div
										className={
											page === "Lobby"
												? "games-grid featured-games-grid"
												: "games-grid"
										}
									>
										{visibleGames.map(gameCard)}
									</div>
								) : (
									<div className="empty">
										No games found. Try another search.
									</div>
								)}
								{page !== "Lobby" &&
									filtered.length > visibleGames.length && (
										<div className="catalog-load-more">
											<span>
												Showing {visibleGames.length} of{" "}
												{filtered.length} games
											</span>
											<button
												className="secondary-btn"
												onClick={() =>
													setCatalogLimit((n) =>
														Math.min(
															n + 48,
															filtered.length,
														),
													)
												}
											>
												LOAD MORE GAMES{" "}
												<ChevronRight size={15} />
											</button>
										</div>
									)}
							</section>
							<section className="content-section">
								<div className="section-head">
									<div>
										<h2>PROVIDER</h2>
										<small>BROWSE GAMES BY PROVIDER</small>
									</div>
									<button
										className="view-all"
										onClick={() => {
											setProviderFilter("All Providers");
											setCategory("Slots");
											setPage("Slots");
											setCatalogLimit(48);
											window.scrollTo({
												top: 0,
												behavior: "smooth",
											});
										}}
									>
										ALL PROVIDERS <ArrowUpRight size={14} />
									</button>
								</div>
								<div className="provider-row">
									<button
										className="provider-tile all-providers"
										onClick={() => {
											setProviderFilter("All Providers");
											setCategory("Slots");
											setPage("Slots");
											setCatalogLimit(48);
											window.scrollTo({
												top: 0,
												behavior: "smooth",
											});
										}}
									>
										<span className="provider-mark">
											<Gamepad2 size={24} />
										</span>
										<b>All Providers</b>
										<small>
											{ASSET_GAME_CATALOG.length} GAMES
										</small>
									</button>
									{ASSET_PROVIDER_CATALOG.map((p) => (
										<button
											className={
												"provider-tile " +
												(providerFilter === p.provider
													? "selected-provider"
													: "")
											}
											key={p.provider}
											onClick={() => {
												setProviderFilter(p.provider);
												setCategory("Slots");
												setPage("Slots");
												setCatalogLimit(48);
												window.scrollTo({
													top: 0,
													behavior: "smooth",
												});
											}}
										>
											<span className="provider-mark">
												<img
													loading="lazy"
													src={p.logoPath}
													alt={p.provider + " logo"}
													onError={(e) => {
														e.currentTarget.style.display =
															"none";
													}}
												/>
											</span>
											<b>{p.provider}</b>
											<small>{p.gameCount} GAMES</small>
										</button>
									))}
								</div>
							</section>
						</>
					) : page === "Dashboard" ? (
						<section className="dashboard">
							<div className="page-heading">
								<div>
									<small>YOUR ACCOUNT</small>
									<h1>Welcome back, {user?.name}</h1>
								</div>
								<button
									className="register-btn"
									onClick={() => setModal("wallet")}
								>
									MANAGE WALLET
								</button>
							</div>
							<div className="stats-grid">
								<div className="stat-card">
									<Wallet />
									<small>AVAILABLE BALANCE</small>
									<strong>{money(wallet.balance)}</strong>
									<button onClick={() => setModal("wallet")}>
										Wallet actions{" "}
										<ChevronRight size={14} />
									</button>
								</div>
								<div className="stat-card">
									<History />
									<small>TRANSACTIONS</small>
									<strong>{transactions.length}</strong>
									<button
										onClick={() => setPage("Transactions")}
									>
										View history <ChevronRight size={14} />
									</button>
								</div>
								<div className="stat-card">
									<Gamepad2 />
									<small>GAMES PLAYED</small>
									<strong>{gameHistory.length}</strong>
									<button
										onClick={() => {
											setPage("Game History");
											loadGameHistory();
										}}
									>
										View game history{" "}
										<ChevronRight size={14} />
									</button>
								</div>
								<div className="stat-card">
									<ShieldCheck />
									<small>ACCOUNT STATUS</small>
									<strong className="green">
										{user?.status === "active"
											? "Active"
											: "Suspended"}
									</strong>
									<small>
										Member since{" "}
										{new Date(
											user?.created_at || Date.now(),
										).toLocaleDateString("en-US")}
									</small>
								</div>
							</div>
							<div className="section-head">
								<h2>RECENT TRANSACTIONS</h2>
								<button
									className="view-all"
									onClick={() => setPage("Transactions")}
								>
									VIEW ALL →
								</button>
							</div>
							<Transactions rows={transactions.slice(0, 5)} />
						</section>
					) : page === "Wallet" ? (
						<section className="dashboard">
							<div className="page-heading">
								<div>
									<small>ACCOUNT</small>
									<h1>My Wallet</h1>
								</div>
							</div>
							<div className="wallet-panel">
								<small>AVAILABLE BALANCE</small>
								<strong>{money(wallet.balance)}</strong>
								<p>
									Deposit and withdrawal requests are reviewed
									by our team.
								</p>
								<div className="wallet-actions">
									<button
										className="register-btn"
										onClick={openDeposit}
									>
										<Plus size={15} /> DEPOSIT REQUEST
									</button>
									<button
										className="secondary-btn"
										onClick={() => setModal("withdraw")}
									>
										<Minus size={15} /> WITHDRAW
									</button>
								</div>
							</div>
							<div className="section-head">
								<h2>RECENT ACTIVITY</h2>
							</div>
							<Transactions rows={transactions} />
						</section>
					) : page === "Transactions" ? (
						<section className="dashboard">
							<div className="page-heading">
								<div>
									<small>ACCOUNT</small>
									<h1>Transactions</h1>
								</div>
								<button
									className="secondary-btn"
									onClick={refresh}
								>
									<RefreshCw size={14} /> Refresh
								</button>
							</div>
							<Transactions rows={transactions} />
						</section>
					) : page === "Game History" ? (
						<section className="dashboard">
							<div className="page-heading">
								<div>
									<small>ACCOUNT ACTIVITY</small>
									<h1>Game History</h1>
									<p>
										Your recent game sessions and recorded
										wagering results.
									</p>
								</div>
								<button
									className="secondary-btn"
									onClick={loadGameHistory}
								>
									<RefreshCw size={14} /> Refresh
								</button>
							</div>
							<div className="table-wrap history-table-wrap">
								<table>
									<thead>
										<tr>
											<th>GAME</th>
											<th>PROVIDER</th>
											<th>SESSIONS</th>
											<th>ROUNDS</th>
											<th>TOTAL BET</th>
											<th>TOTAL WIN</th>
											<th>LAST PLAYED</th>
										</tr>
									</thead>
									<tbody>
										{gameHistory.map((g) => (
											<tr key={g.id || g.session_id}>
												<td>
													<b>{g.title}</b>
													<small>{g.slug}</small>
												</td>
												<td>{g.provider || "—"}</td>
												<td>{g.session_count || 1}</td>
												<td>{g.round_count || 0}</td>
												<td>
													{money(g.total_bet || 0)}
												</td>
												<td>
													{money(g.total_win || 0)}
												</td>
												<td>
													{g.last_played_at
														? new Date(
																g.last_played_at,
															).toLocaleString(
																"en-US",
															)
														: "—"}
												</td>
											</tr>
										))}
									</tbody>
								</table>
								{!gameHistory.length && (
									<div className="empty">
										No game history yet. Launch a game to
										see your activity here.
									</div>
								)}
							</div>
						</section>
					) : page === "Admin" ? (
						<section className="dashboard">
							<div className="page-heading">
								<div>
									<small>CONTROL CENTER</small>
									<h1>Admin dashboard</h1>
								</div>
								<div className="admin-head-actions">
									<button
										className="secondary-btn"
										onClick={openGameManagement}
									>
										<Gamepad2 size={14} /> Manage games
									</button>
									<button
										className="secondary-btn"
										onClick={openProviderManagement}
									>
										Manage providers
									</button>
									<button
										className="secondary-btn"
										onClick={() => openGameSettings()}
									>
										<RefreshCw size={14} /> Game settings /
										RTP
									</button>
									<button
										className="secondary-btn"
										onClick={openBannerManagement}
									>
										<ImagePlus size={14} /> Manage banners
									</button>
									<button
										className="secondary-btn"
										onClick={openDepositSettings}
									>
										<Wallet size={14} /> Deposit methods
									</button>
									<button
										className="secondary-btn"
										onClick={openAdmin}
									>
										<RefreshCw size={14} /> Refresh
									</button>
								</div>
							</div>
							<div className="stats-grid">
								{[
									[
										"TOTAL USERS",
										adminData.summary?.users ?? "—",
										Users,
									],
									[
										"PENDING REQUESTS",
										adminData.summary?.pending ?? "—",
										Clock,
									],
									[
										"WALLET BALANCE",
										money(adminData.summary?.walletBalance),
										Wallet,
									],
									[
										"TRANSACTIONS",
										adminData.summary?.transactions ?? "—",
										History,
									],
								].map(([l, v, I]) => (
									<div className="stat-card" key={l}>
										<I />
										<small>{l}</small>
										<strong>{v}</strong>
									</div>
								))}
							</div>
							<div className="section-head">
								<h2>TRANSACTION REVIEW</h2>
							</div>
							<div className="table-wrap">
								<table>
									<thead>
										<tr>
											<th>USER / REF</th>
											<th>TYPE</th>
											<th>AMOUNT</th>
											<th>STATUS</th>
											<th>ACTION</th>
										</tr>
									</thead>
									<tbody>
										{adminData.transactions.map((t) => (
											<tr key={t.id}>
												<td>
													<b>{t.name}</b>
													<small>{t.reference}</small>
													<small>
														{t.note ||
															"No transaction details"}
													</small>
												</td>
												<td>
													{t.type === "withdrawal"
														? "Withdrawal"
														: t.type === "deposit"
															? "Deposit"
															: t.type}
												</td>
												<td>{money(t.amount)}</td>
												<td>
													<Status status={t.status} />
												</td>
												<td>
													{t.status === "pending" ? (
														<div className="review-actions">
															<button
																onClick={() =>
																	review(
																		t.id,
																		"approve",
																	)
																}
																title="Approve"
															>
																<CheckCircle
																	size={15}
																/>
															</button>
															<button
																onClick={() =>
																	review(
																		t.id,
																		"reject",
																	)
																}
																title="Reject"
															>
																<X size={15} />
															</button>
														</div>
													) : (
														"—"
													)}
												</td>
											</tr>
										))}
									</tbody>
								</table>
								{!adminData.transactions.length && (
									<div className="empty">
										No transactions yet.
									</div>
								)}
							</div>
							<div className="section-head admin-users-head">
								<h2>RECENT GAME ACTIVITY</h2>
							</div>
							<div className="table-wrap history-table-wrap">
								<table>
									<thead>
										<tr>
											<th>USER</th>
											<th>GAME</th>
											<th>PROVIDER</th>
											<th>SESSIONS</th>
											<th>ROUNDS</th>
											<th>TOTAL BET</th>
											<th>TOTAL WIN</th>
											<th>LAST PLAYED</th>
										</tr>
									</thead>
									<tbody>
										{adminData.gameHistory.map((g) => (
											<tr key={g.id || g.session_id}>
												<td>
													<b>{g.name}</b>
													<small>{g.email}</small>
												</td>
												<td>{g.title}</td>
												<td>{g.provider || "—"}</td>
												<td>{g.session_count || 1}</td>
												<td>{g.round_count || 0}</td>
												<td>
													{money(g.total_bet || 0)}
												</td>
												<td>
													{money(g.total_win || 0)}
												</td>
												<td>
													{g.last_played_at
														? new Date(
																g.last_played_at,
															).toLocaleString(
																"en-US",
															)
														: "—"}
												</td>
											</tr>
										))}
									</tbody>
								</table>
								{!adminData.gameHistory.length && (
									<div className="empty">
										No game activity has been recorded yet.
									</div>
								)}
							</div>
							<div className="section-head admin-users-head">
								<h2>USER MANAGEMENT</h2>
							</div>
							<div className="table-wrap">
								<table>
									<thead>
										<tr>
											<th>USER</th>
											<th>ROLE</th>
											<th>BALANCE</th>
											<th>STATUS</th>
											<th>ACTION</th>
										</tr>
									</thead>
									<tbody>
										{adminData.users.map((u) => (
											<tr key={u.id}>
												<td>
													<b>{u.name}</b>
													<small>{u.email}</small>
												</td>
												<td>{u.role}</td>
												<td>{money(u.balance)}</td>
												<td>
													<Status status={u.status} />
												</td>
												<td>
													<button
														className="text-action"
														onClick={async () => {
															await api(
																"/admin/users/" +
																	u.id +
																	"/status",
																{
																	method: "PATCH",
																	body: JSON.stringify(
																		{
																			status:
																				u.status ===
																				"active"
																					? "suspended"
																					: "active",
																		},
																	),
																},
															);
															openAdmin();
														}}
													>
														{u.status === "active"
															? "Suspend"
															: "Activate"}
													</button>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</section>
					) : page === "Deposit Settings" ? (
						<section className="dashboard">
							<div className="page-heading">
								<div>
									<small>PAYMENT CONFIGURATION</small>
									<h1>Deposit methods</h1>
									<p>
										Enable or disable manual payment methods
										and edit the payment instructions shown
										to users.
									</p>
								</div>
								<button
									className="secondary-btn"
									onClick={openAdmin}
								>
									Back to admin
								</button>
							</div>
							<div className="deposit-settings-grid">
								{adminDepositMethods.map((m) => (
									<article
										className="banner-admin-card deposit-setting-card"
										key={m.id}
									>
										<div className="deposit-setting-heading">
											<div>
												<h2>{m.name}</h2>
												<small>{m.method_key}</small>
											</div>
											<label className="toggle-label">
												<input
													type="checkbox"
													checked={!!m.enabled}
													onChange={(e) =>
														updateDepositMethod(
															m.id,
															{
																enabled:
																	e.target
																		.checked,
															},
														)
													}
												/>
												<span>
													{m.enabled
														? "Enabled"
														: "Disabled"}
												</span>
											</label>
										</div>
										<label>
											Payment instructions
											<textarea
												rows="3"
												maxLength="3000"
												value={m.instructions || ""}
												onChange={(e) =>
													setAdminDepositMethods(
														(prev) =>
															prev.map((x) =>
																x.id === m.id
																	? {
																			...x,
																			instructions:
																				e
																					.target
																					.value,
																		}
																	: x,
															),
													)
												}
											/>
										</label>
										<label>
											Wallet address / bank account
											details
											<textarea
												rows="3"
												maxLength="3000"
												value={m.payment_details || ""}
												onChange={(e) =>
													setAdminDepositMethods(
														(prev) =>
															prev.map((x) =>
																x.id === m.id
																	? {
																			...x,
																			payment_details:
																				e
																					.target
																					.value,
																		}
																	: x,
															),
													)
												}
												placeholder="Enter the official wallet address or bank account details"
											/>
										</label>
										<button
											className="register-btn"
											onClick={() =>
												updateDepositMethod(m.id, {
													instructions:
														m.instructions || "",
													payment_details:
														m.payment_details || "",
												})
											}
										>
											SAVE {m.name.toUpperCase()}
										</button>
									</article>
								))}
								{!adminDepositMethods.length && (
									<div className="empty">
										No deposit methods configured.
									</div>
								)}
							</div>
						</section>
					) : page === "Game Settings" ? (
						<section className="dashboard">
							<div className="page-heading">
								<div>
									<small>GAME ENGINE CONFIGURATION</small>
									<h1>Game settings & RTP</h1>
									<p>
										Server-side configuration. Changes are
										stored in MySQL and applied to supported
										game engines.
									</p>
								</div>
								<button
									className="secondary-btn"
									onClick={openAdmin}
								>
									Back to admin
								</button>
							</div>
							<form
								className="banner-admin-card game-settings-form"
								onSubmit={saveGameSettings}
							>
								<div className="settings-game-picker">
									<label htmlFor="settings-game-select">
										Select game
									</label>
									<select
										id="settings-game-select"
										className="game-settings-select"
										value={settingsSlug}
										onChange={(e) =>
											changeSettingsGame(e.target.value)
										}
									>
										{adminGames.map((g) => (
											<option key={g.slug} value={g.slug}>
												{g.title} · {g.slug}
											</option>
										))}
										{!adminGames.some(
											(g) =>
												g.slug === "gates-of-olympus",
										) && (
											<option value="gates-of-olympus">
												Gates of Olympus ·
												gates-of-olympus
											</option>
										)}
									</select>
									<small>
										Choose a game to configure its RTP,
										bets, reels and win limits.
									</small>
									{gameSettings && (gameSettings.engineSupported === false || Number(gameSettings.engineSupported) === 0) && (
										<small className="settings-engine-note">
											Catalog settings are stored for this game, but a compatible server game engine has not been implemented yet.
										</small>
									)}
								</div>
								{gameSettings && (
									<>
										<div className="stats-grid">
											<label className="setting-field">
												Game enabled
												<select
													value={String(
														gameSettings.enabled,
													)}
													onChange={(e) =>
														setGameSettings({
															...gameSettings,
															enabled:
																e.target
																	.value ===
																"true",
														})
													}
												>
													<option value="true">
														Enabled
													</option>
													<option value="false">
														Disabled
													</option>
												</select>
											</label>
											<label className="setting-field">
												Target RTP (%)
												<input
													type="number"
													min="1"
													max="99.99"
													step="0.01"
													value={
														gameSettings.targetRtp ??
														96.5
													}
													onChange={(e) =>
														setGameSettings({
															...gameSettings,
															targetRtp: Number(
																e.target.value,
															),
														})
													}
												/>
											</label>
											<label className="setting-field">
												Minimum bet (USD)
												<input
													type="number"
													min="0.01"
													step="0.01"
													value={
														gameSettings.minCoinBet ??
														0.01
													}
													onChange={(e) =>
														setGameSettings({
															...gameSettings,
															minCoinBet: Number(
																e.target.value,
															),
														})
													}
												/>
											</label>
											<label className="setting-field">
												Maximum bet (USD)
												<input
													type="number"
													min="0.01"
													step="0.01"
													value={
														gameSettings.maxCoinBet ??
														5
													}
													onChange={(e) =>
														setGameSettings({
															...gameSettings,
															maxCoinBet: Number(
																e.target.value,
															),
														})
													}
												/>
											</label>
											<label className="setting-field">
												Allowed bets (USD,
												comma-separated)
												<input
													value={settingsBets}
													onChange={(e) =>
														setSettingsBets(
															e.target.value,
														)
													}
												/>
											</label>
											<label className="setting-field">
												Lines
												<input
													type="number"
													min="1"
													max="100"
													value={
														gameSettings.lines ?? 20
													}
													onChange={(e) =>
														setGameSettings({
															...gameSettings,
															lines: Number(
																e.target.value,
															),
														})
													}
												/>
											</label>
											<label className="setting-field">
												Buy Free Spins multiplier
												<input
													type="number"
													min="1"
													max="10000"
													value={
														gameSettings.buyFreeSpinsMultiplier ??
														100
													}
													onChange={(e) =>
														setGameSettings({
															...gameSettings,
															buyFreeSpinsMultiplier:
																Number(
																	e.target
																		.value,
																),
														})
													}
												/>
											</label>
											<label className="setting-field">
												Maximum win multiplier
												<input
													type="number"
													min="1"
													max="1000000"
													value={
														gameSettings.maxWinMultiplier ??
														5000
													}
													onChange={(e) =>
														setGameSettings({
															...gameSettings,
															maxWinMultiplier:
																Number(
																	e.target
																		.value,
																),
														})
													}
												/>
											</label>
											<label className="setting-field">
												Multiplier symbol ID
												<input
													type="number"
													min="0"
													max="100"
													value={
														gameSettings.multiplierSymbol ??
														12
													}
													onChange={(e) =>
														setGameSettings({
															...gameSettings,
															multiplierSymbol:
																Number(
																	e.target
																		.value,
																),
														})
													}
												/>
											</label>
											<label className="setting-field">
												Multiplier values
												(comma-separated)
												<input
													type="text"
													maxLength="500"
													value={
														gameSettings.multiplierValues ??
														"2,3,4,5,6,8,10,12,15,20,25,50,100,250,500"
													}
													onChange={(e) =>
														setGameSettings({
															...gameSettings,
															multiplierValues:
																e.target.value,
														})
													}
												/>
											</label>
											<label className="setting-field">
												Jackpot contribution (%)
												<input
													type="number"
													min="0"
													max="10"
													step="0.01"
													value={
														gameSettings.jackpotPercent ??
														0
													}
													onChange={(e) =>
														setGameSettings({
															...gameSettings,
															jackpotPercent:
																Number(
																	e.target
																		.value,
																),
														})
													}
												/>
											</label>
											<label className="setting-field">
												Free Spins awarded
												<input
													type="number"
													min="1"
													max="1000"
													value={
														gameSettings.settingsFs ??
														15
													}
													onChange={(e) =>
														setGameSettings({
															...gameSettings,
															settingsFs: Number(
																e.target.value,
															),
														})
													}
												/>
											</label>
											<label className="setting-field">
												Scatters needed for Free Spins
												<input
													type="number"
													min="3"
													max="30"
													value={
														gameSettings.settingsNeedFs ??
														4
													}
													onChange={(e) =>
														setGameSettings({
															...gameSettings,
															settingsNeedFs:
																Number(
																	e.target
																		.value,
																),
														})
													}
												/>
											</label>
											<label className="setting-field">
												Free Spins add threshold
												<input
													type="number"
													min="3"
													max="30"
													value={
														gameSettings.settingsNeedAddFs ??
														3
													}
													onChange={(e) =>
														setGameSettings({
															...gameSettings,
															settingsNeedAddFs:
																Number(
																	e.target
																		.value,
																),
														})
													}
												/>
											</label>
											<label className="setting-field">
												Added Free Spins
												<input
													type="number"
													min="1"
													max="1000"
													value={
														gameSettings.settingsAddFs ??
														5
													}
													onChange={(e) =>
														setGameSettings({
															...gameSettings,
															settingsAddFs:
																Number(
																	e.target
																		.value,
																),
														})
													}
												/>
											</label>
											<label className="setting-field">
												Regular reel set
												<input
													type="number"
													min="0"
													max="8"
													value={
														gameSettings.reelSetRegular ??
														0
													}
													onChange={(e) =>
														setGameSettings({
															...gameSettings,
															reelSetRegular:
																Number(
																	e.target
																		.value,
																),
														})
													}
												/>
											</label>
											<label className="setting-field">
												Double Chance reel set
												<input
													type="number"
													min="0"
													max="8"
													value={
														gameSettings.reelSetDoubleChance ??
														2
													}
													onChange={(e) =>
														setGameSettings({
															...gameSettings,
															reelSetDoubleChance:
																Number(
																	e.target
																		.value,
																),
														})
													}
												/>
											</label>
											<label className="setting-field">
												Free Spins reel set
												<input
													type="number"
													min="0"
													max="8"
													value={
														gameSettings.reelSetFreeSpin ??
														1
													}
													onChange={(e) =>
														setGameSettings({
															...gameSettings,
															reelSetFreeSpin:
																Number(
																	e.target
																		.value,
																),
														})
													}
												/>
											</label>
											<label className="setting-field wide">
												Paytable override (optional; PHP
												format: semicolon-separated
												symbol rows)
												<textarea
													rows="4"
													value={
														gameSettings.paytable ||
														""
													}
													onChange={(e) =>
														setGameSettings({
															...gameSettings,
															paytable:
																e.target
																	.value ||
																null,
														})
													}
													placeholder="Leave blank to use the PHP init.php paytable"
												/>
											</label>
											<label className="setting-field wide">
												Regular reel strip override
												(optional; use ~ between reels)
												<textarea
													rows="4"
													value={
														gameSettings.reelSet0 ||
														""
													}
													onChange={(e) =>
														setGameSettings({
															...gameSettings,
															reelSet0:
																e.target
																	.value ||
																null,
														})
													}
													placeholder="Leave blank to use reel_set0 from init.php"
												/>
											</label>
											<label className="setting-field wide">
												Free Spins reel strip override
												(optional)
												<textarea
													rows="4"
													value={
														gameSettings.reelSet1 ||
														""
													}
													onChange={(e) =>
														setGameSettings({
															...gameSettings,
															reelSet1:
																e.target
																	.value ||
																null,
														})
													}
													placeholder="Leave blank to use reel_set1 from init.php"
												/>
											</label>
											<label className="setting-field wide">
												Double Chance reel strip
												override (optional)
												<textarea
													rows="4"
													value={
														gameSettings.reelSet2 ||
														""
													}
													onChange={(e) =>
														setGameSettings({
															...gameSettings,
															reelSet2:
																e.target
																	.value ||
																null,
														})
													}
													placeholder="Leave blank to use reel_set2 from init.php"
												/>
											</label>
											<label className="setting-field">
												Double Chance
												<select
													value={String(
														gameSettings.doubleChanceEnabled !==
															false,
													)}
													onChange={(e) =>
														setGameSettings({
															...gameSettings,
															doubleChanceEnabled:
																e.target
																	.value ===
																"true",
														})
													}
												>
													<option value="true">
														Enabled
													</option>
													<option value="false">
														Disabled
													</option>
												</select>
											</label>
											<label className="setting-field">
												Enforce maximum win
												<select
													value={String(
														gameSettings.maxWinEnforced !==
															false,
													)}
													onChange={(e) =>
														setGameSettings({
															...gameSettings,
															maxWinEnforced:
																e.target
																	.value ===
																"true",
														})
													}
												>
													<option value="true">
														Enabled
													</option>
													<option value="false">
														Disabled
													</option>
												</select>
											</label>
										</div>
										<p className="setting-note">
											Important: Target RTP is a
											configuration target, not a
											guarantee. To make actual RTP match
											the target, the reel math/paytable
											must be statistically recalibrated
											and tested. Jackpot contribution
											adds funds to the pool; the supplied
											PHP reference does not define a
											jackpot trigger or payout rule.
										</p>
										<button
											className="register-btn"
											disabled={busy}
										>
											{busy
												? "SAVING…"
												: "SAVE GAME SETTINGS"}
										</button>
									</>
								)}
							</form>
						</section>
					) : page === "Banner Management" ? (
						<section className="dashboard">
							<div className="page-heading">
								<div>
									<small>LOBBY CONTENT</small>
									<h1>Banner management</h1>
									<p>
										Image-only slider. Each image can link
										to an internal page or external URL.
									</p>
								</div>
								<button
									className="secondary-btn"
									onClick={openAdmin}
								>
									Back to admin
								</button>
							</div>
							<div className="banner-admin-card">
								<h2>
									<ImagePlus size={18} /> Add banner
								</h2>
								<form
									className="banner-upload-form"
									onSubmit={uploadBanner}
									encType="multipart/form-data"
								>
									<label>
										Banner image (JPG, PNG, WEBP)
										<input
											type="file"
											name="image"
											accept="image/jpeg,image/png,image/webp"
											required
										/>
									</label>
									<label>
										Click destination URL
										<input
											name="link_url"
											type="url"
											maxLength="500"
											placeholder="https://example.com/promotion or http://localhost:5173/Slots"
										/>
									</label>
									<button
										className="register-btn"
										disabled={busy}
									>
										{busy ? "UPLOADING…" : "UPLOAD BANNER"}
									</button>
									<small>
										Recommended wide image ratio: 3:1 or
										16:5. No text or buttons are overlaid on
										the banner.
									</small>
								</form>
							</div>
							<div className="banner-admin-grid">
								{adminBanners.map((b) => (
									<article
										className="banner-admin-item"
										key={b.id}
									>
										<img src={b.image_url} alt="" />
										<div className="banner-admin-meta">
											<div>
												<b>
													{b.link_url ||
														"No destination"}
												</b>
												<small>{b.image_url}</small>
											</div>
											<span
												className={
													"status status-" +
													(Number(b.active)
														? "active"
														: "hidden")
												}
											>
												{Number(b.active)
													? "Active"
													: "Hidden"}
											</span>
										</div>
										<div className="banner-admin-actions">
											<button
												className="secondary-btn"
												onClick={() =>
													toggleBanner(
														b.id,
														!!Number(b.active),
													)
												}
											>
												{Number(b.active)
													? "Hide"
													: "Activate"}
											</button>
											<button
												className="danger-btn"
												onClick={() =>
													deleteBanner(b.id)
												}
											>
												<Trash2 size={14} /> Delete
											</button>
										</div>
									</article>
								))}
								{!adminBanners.length && (
									<div className="empty">
										No banners yet. Upload the first banner
										above.
									</div>
								)}
							</div>
						</section>
					) : page === "Provider Management" ? (
						<section className="dashboard">
							<div className="page-heading">
								<div>
									<small>CATALOG CONTROL</small>
									<h1>Provider management</h1>
									<p>
										Providers are stored in the database.
										Providers without games remain listed;
										disable a provider to hide all of its
										games from the lobby.
									</p>
								</div>
								<button
									className="secondary-btn"
									onClick={openAdmin}
								>
									Back to admin
								</button>
							</div>
							<div className="table-wrap">
								<table>
									<thead>
										<tr>
											<th>PROVIDER</th>
											<th>GAME COUNT</th>
											<th>STATUS</th>
											<th>ACTION</th>
										</tr>
									</thead>
									<tbody>
										{providers.map((p) => (
											<tr key={p.provider}>
												<td>
													<div className="admin-game-cell">
														<img
															src={
																p.logo_path ||
																"/providers/pragmatic.svg"
															}
															alt=""
															onError={(e) =>
																(e.currentTarget.style.display =
																	"none")
															}
														/>
														<b>{p.provider}</b>
													</div>
												</td>
												<td>
													{Number(p.game_count || 0)}
												</td>
												<td>
													<Status
														status={
															Number(p.active)
																? "active"
																: "hidden"
														}
													/>
												</td>
												<td>
													<button
														className="text-action"
														onClick={() =>
															toggleProvider(
																p.provider,
																!!Number(
																	p.active,
																),
															)
														}
													>
														{Number(p.active)
															? "Deactivate"
															: "Activate"}
													</button>
												</td>
											</tr>
										))}
									</tbody>
								</table>
								{!providers.length && (
									<div className="empty">
										No providers found.
									</div>
								)}
							</div>
						</section>
					) : page === "Game Management" ? (
						<section className="dashboard">
							<div className="page-heading">
								<div>
									<small>CATALOG CONTROL</small>
									<h1>Game management</h1>
									<p>
										Edit providers, visibility, featured
										placement and the NEW badge.
									</p>
								</div>
								<button
									className="secondary-btn"
									onClick={openAdmin}
								>
									Back to admin
								</button>
							</div>
							<div className="table-wrap">
								<table>
									<thead>
										<tr>
											<th>GAME</th>
											<th>PROVIDER</th>
											<th>STATUS</th>
											<th>FEATURED</th>
											<th>NEW</th>
											<th>ACTION</th>
										</tr>
									</thead>
									<tbody>
										{adminGames.map((g) => (
											<tr key={g.id}>
												<td>
													<div className="admin-game-cell">
														<img
															src={g.image_path}
															onError={(e) =>
																(e.currentTarget.style.display =
																	"none")
															}
														/>
														<div>
															{gameEdit?.id ===
															g.id ? (
																<input
																	className="inline-edit"
																	value={
																		gameEdit.title
																	}
																	onChange={(
																		e,
																	) =>
																		setGameEdit(
																			{
																				...gameEdit,
																				title: e
																					.target
																					.value,
																			},
																		)
																	}
																/>
															) : (
																<b>{g.title}</b>
															)}
															<small>
																{g.category} ·{" "}
																{g.slug}
															</small>
														</div>
													</div>
												</td>
												<td>
													{gameEdit?.id === g.id ? (
														<input
															className="inline-edit"
															value={
																gameEdit.provider
															}
															onChange={(e) =>
																setGameEdit({
																	...gameEdit,
																	provider:
																		e.target
																			.value,
																})
															}
														/>
													) : (
														g.provider
													)}
												</td>
												<td>
													{gameEdit?.id === g.id ? (
														<select
															className="inline-edit"
															value={
																gameEdit.status
															}
															onChange={(e) =>
																setGameEdit({
																	...gameEdit,
																	status: e
																		.target
																		.value,
																})
															}
														>
															<option value="active">
																Active
															</option>
															<option value="hidden">
																Hidden
															</option>
														</select>
													) : (
														<Status
															status={g.status}
														/>
													)}
												</td>
												<td>
													<button
														className={
															"featured-toggle " +
															(Number(g.featured)
																? "on"
																: "")
														}
														onClick={() =>
															saveGame(g.id, {
																featured:
																	!Number(
																		g.featured,
																	),
															})
														}
													>
														{Number(g.featured)
															? "★ Featured"
															: "☆ Feature"}
													</button>
												</td>
												<td>
													<button
														className={
															"featured-toggle " +
															(Number(g.is_new)
																? "on"
																: "")
														}
														onClick={() =>
															saveGame(g.id, {
																is_new: !Number(
																	g.is_new,
																),
															})
														}
													>
														{Number(g.is_new)
															? "NEW ✓"
															: "Mark NEW"}
													</button>
												</td>
												<td>
													{gameEdit?.id === g.id ? (
														<div className="review-actions">
															<button
																onClick={() =>
																	saveGame(
																		g.id,
																		{
																			title: gameEdit.title,
																			provider:
																				gameEdit.provider,
																			status: gameEdit.status,
																		},
																	)
																}
															>
																<CheckCircle
																	size={15}
																/>
															</button>
															<button
																onClick={() =>
																	setGameEdit(
																		null,
																	)
																}
															>
																<X size={15} />
															</button>
														</div>
													) : (
														<button
															className="text-action"
															onClick={() =>
																setGameEdit({
																	id: g.id,
																	title: g.title,
																	provider:
																		g.provider,
																	status: g.status,
																})
															}
														>
															Edit
														</button>
													)}
												</td>
											</tr>
										))}
									</tbody>
								</table>
								{!adminGames.length && (
									<div className="empty">No games found.</div>
								)}
							</div>
						</section>
					) : (
						<section className="dashboard">
							<h1>{page}</h1>
							<div className="empty">
								This section is coming soon.
							</div>
						</section>
					)}
					<footer className="footer">
						<div className="footer-brand">
							ZYVALLE<span>BET</span>
							<p>
								A premium game lobby experience.
								<br />
								Play responsibly. 18+ only.
							</p>
						</div>
						<div>
							<b>EXPLORE</b>
							<a onClick={() => setPage("Lobby")}>Lobby</a>
							<a onClick={() => setPage("Slots")}>Slots</a>
							<a
								onClick={() =>
									setNotice(
										"Support has not been configured yet.",
									)
								}
							>
								Support
							</a>
						</div>
						<div>
							<b>ACCOUNT</b>
							<a
								onClick={() =>
									user
										? setPage("Dashboard")
										: setModal("login")
								}
							>
								Dashboard
							</a>
							<a
								onClick={() =>
									user ? setPage("Wallet") : setModal("login")
								}
							>
								Wallet
							</a>
							<a
								onClick={() =>
									setNotice(
										"Responsible gaming: set limits and never gamble with money needed for essentials.",
									)
								}
							>
								Responsible Play
							</a>
						</div>
						<div className="footer-bottom">
							© 2026 Zyvalle Bet. All rights reserved.{" "}
							<span>18+ · Play responsibly</span>
						</div>
					</footer>
				</main>
			</div>
			{activeGame && (
				<div
					className="game-overlay"
					role="dialog"
					aria-modal="true"
					aria-label={activeGame.title || "Game"}
				>
					<div className="game-overlay-bar">
						<span>{activeGame.title || "Gates of Olympus"}</span>
						<button
							type="button"
							className="game-exit"
							onClick={() => setActiveGame(null)}
						>
							<X size={17} /> EXIT GAME
						</button>
					</div>
					<iframe
						key={gameAssetUrl()}
						className="game-frame"
						title={activeGame.title || "Gates of Olympus"}
						src={gameAssetUrl()}
						allow="fullscreen; autoplay; gamepad; clipboard-read; clipboard-write"
						allowFullScreen
					/>
				</div>
			)}
			{notice && (
				<div className="toast">
					<CheckCircle size={17} />
					{notice}
					<button onClick={() => setNotice("")}>
						<X size={15} />
					</button>
				</div>
			)}
			{modal && (
				<div className="modal-backdrop" onClick={() => setModal("")}>
					<div className="modal" onClick={(e) => e.stopPropagation()}>
						<button
							className="modal-close"
							onClick={() => {
								setModal("");
								setError("");
							}}
						>
							<X size={18} />
						</button>
						{modal === "login" || modal === "register" ? (
							<>
								<div className="modal-logo">
									ZYVALLE<span>BET</span>
								</div>
								<h2>
									{modal === "register"
										? "Create your account"
										: "Welcome back"}
								</h2>
								<p>
									{modal === "register"
										? "Join the Zyvalle community."
										: "Sign in to access your wallet and account."}
								</p>
								<form onSubmit={authSubmit}>
									{modal === "register" && (
										<label>
											Display name
											<input
												name="name"
												minLength="2"
												maxLength="60"
												required
												placeholder="Your name"
											/>
										</label>
									)}
									<label>
										Email address
										<input
											name="email"
											type="email"
											maxLength="190"
											required
											placeholder="you@example.com"
										/>
									</label>
									<label>
										Password
										<input
											name="password"
											type="password"
											minLength={
												modal === "register" ? 10 : 1
											}
											maxLength="72"
											required
											placeholder={
												modal === "register"
													? "At least 10 characters"
													: "Your password"
											}
										/>
									</label>
									{error && (
										<div className="form-error">
											{error}
										</div>
									)}
									<button
										className="register-btn full"
										disabled={busy}
									>
										{busy
											? "PLEASE WAIT…"
											: modal === "register"
												? "CREATE ACCOUNT"
												: "LOGIN"}
									</button>
								</form>
								<div className="modal-switch">
									{modal === "register"
										? "Already have an account?"
										: "New to Zyvalle?"}{" "}
									<button
										onClick={() => {
											setModal(
												modal === "register"
													? "login"
													: "register",
											);
											setError("");
										}}
									>
										{modal === "register"
											? "Login"
											: "Register"}
									</button>
								</div>
							</>
						) : modal === "game-assets" ? (
							<>
								<div className="asset-warning-icon">
									<AlertCircle size={28} />
								</div>
								<h2>Game integration unavailable</h2>
								<p>
									Game assets or libraries have not been
									integrated. Please join our Discord server
									to download the game assets and libraries.
								</p>
								<div className="asset-game-name">
									{missingGameTitle}
								</div>
								<a
									className="register-btn full discord-join-btn"
									href={
										import.meta.env
											.VITE_DISCORD_SERVER_URL || "#"
									}
									target="_blank"
									rel="noreferrer"
									onClick={(e) => {
										if (
											!import.meta.env
												.VITE_DISCORD_SERVER_URL
										) {
											e.preventDefault();
											setError(
												"Discord server link is not configured. Set VITE_DISCORD_SERVER_URL in client/.env.",
											);
										}
									}}
								>
									JOIN DISCORD SERVER
								</a>
								<div className="discord-copy-row">
									<code>
										{import.meta.env
											.VITE_DISCORD_USERNAME ||
											"Discord username not configured"}
									</code>
									<button
										className="secondary-btn"
										onClick={async () => {
											const username =
												import.meta.env
													.VITE_DISCORD_USERNAME ||
												"";
											if (!username) {
												setError(
													"Discord username is not configured. Set VITE_DISCORD_USERNAME in client/.env.",
												);
												return;
											}
											try {
												await navigator.clipboard.writeText(
													username,
												);
												setNotice(
													"Discord username copied.",
												);
											} catch {
												setError(
													"Could not access clipboard. Copy the username manually.",
												);
											}
										}}
									>
										COPY USERNAME
									</button>
								</div>
								{error && (
									<div className="form-error">{error}</div>
								)}
								<button
									className="secondary-btn full"
									onClick={() => {
										setModal("");
										setError("");
									}}
								>
									CLOSE
								</button>
							</>
						) : modal === "wallet" ? (
							<>
								<h2>Wallet actions</h2>
								<p>
									Choose a wallet action. Deposit and
									withdrawal requests are reviewed by an
									administrator.
								</p>
								<div className="modal-actions">
									<button
										className="register-btn"
										onClick={openDeposit}
									>
										<Plus size={15} /> Deposit request
									</button>
									<button
										className="secondary-btn"
										onClick={() => setModal("withdraw")}
									>
										<Minus size={15} /> Withdraw
									</button>
								</div>
								<div className="balance-line">
									<span>Available balance</span>
									<strong>{money(wallet.balance)}</strong>
								</div>
							</>
						) : (
							<>
								<h2>
									{modal === "deposit"
										? "Deposit funds"
										: "Withdraw funds"}
								</h2>
								<p>
									{modal === "deposit"
										? "Choose an available manual payment method. Your wallet is credited after an administrator verifies the payment."
										: "Enter your USD withdrawal amount and destination details. The requested amount is reserved until an administrator reviews it."}
								</p>
								{modal === "deposit" && (
									<div className="payment-method-list">
										{depositMethods.map((m) => (
											<label
												className={
													"payment-method-option " +
													(String(depositMethodId) ===
													String(m.id)
														? "selected"
														: "")
												}
												key={m.id}
											>
												<input
													type="radio"
													name="deposit-method"
													value={m.id}
													checked={
														String(
															depositMethodId,
														) === String(m.id)
													}
													onChange={() =>
														setDepositMethodId(
															String(m.id),
														)
													}
												/>
												<span>
													<b>{m.name}</b>
													<small>
														{m.instructions ||
															"Manual payment — admin verification required."}
													</small>
													{m.payment_details && (
														<em>
															{m.payment_details}
														</em>
													)}
												</span>
											</label>
										))}
										{!depositMethods.length && (
											<div className="form-error">
												No deposit method is currently
												enabled. Please contact support.
											</div>
										)}
									</div>
								)}
								<form
									onSubmit={(e) => {
										e.preventDefault();
										requestMoney(
											modal === "deposit"
												? "deposit"
												: "withdraw",
										);
									}}
								>
									<label>Amount (USD)</label>
									<div className="money-input-wrap">
										<span>$</span>
										<input
											type="number"
											min="1"
											max="100000"
											step="0.01"
											inputMode="decimal"
											required
											value={amount}
											onChange={(e) =>
												setAmount(e.target.value)
											}
										/>
									</div>
									<div className="amount-quick">
										{[10, 25, 50, 100].map((n) => (
											<button
												type="button"
												key={n}
												onClick={() =>
													setAmount(n.toFixed(2))
												}
											>
												${n.toFixed(2)}
											</button>
										))}
									</div>
									<label>
										{modal === "deposit"
											? "Payment reference / note (optional)"
											: "Withdrawal destination details"}
									</label>
									<textarea
										value={note}
										onChange={(e) =>
											setNote(e.target.value)
										}
										maxLength="240"
										required={modal === "withdraw"}
										placeholder={
											modal === "deposit"
												? "Transaction hash or payment reference"
												: "Bank name, account holder and account number"
										}
									/>
									{error && (
										<div className="form-error">
											{error}
										</div>
									)}
									<button
										className="register-btn full"
										disabled={
											busy ||
											(modal === "deposit" &&
												!depositMethods.length)
										}
									>
										{busy
											? "PROCESSING…"
											: modal === "deposit"
												? "SUBMIT DEPOSIT REQUEST"
												: "SUBMIT WITHDRAWAL REQUEST"}
									</button>
								</form>
							</>
						)}
					</div>
				</div>
			)}
		</>
	);
}
function Status({ status }) {
	return <span className={"status status-" + status}>{status}</span>;
}
function Transactions({ rows }) {
	return (
		<div className="table-wrap">
			<table>
				<thead>
					<tr>
						<th>REFERENCE</th>
						<th>TYPE</th>
						<th>AMOUNT</th>
						<th>STATUS</th>
						<th>DATE</th>
					</tr>
				</thead>
				<tbody>
					{rows.map((t) => (
						<tr key={t.id}>
							<td>
								<b>{t.reference}</b>
								<small>{t.note || "—"}</small>
							</td>
							<td>
								{t.type === "withdrawal"
									? "Withdrawal"
									: t.type === "deposit"
										? "Deposit"
										: t.type}
							</td>
							<td>{money(t.amount)}</td>
							<td>
								<Status status={t.status} />
							</td>
							<td>
								{new Date(t.created_at).toLocaleDateString(
									"en-US",
								)}
							</td>
						</tr>
					))}
				</tbody>
			</table>
			{!rows.length && (
				<div className="empty">No transactions to display.</div>
			)}
		</div>
	);
}

createRoot(document.getElementById("root")).render(<App />);
