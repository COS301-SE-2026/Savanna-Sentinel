import React, { useEffect, useState } from 'react';
import { usersApi } from '@/services/usersApi';
import type { UserProfile } from '@/services/usersApi';
import { useAuthStore } from '@/store/authStore';

const BrandHeader: React.FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => (
	<header className="mb-8 rounded-md" style={{ background: '#003A6B', color: '#fff', padding: '20px' }}>
		<div className="max-w-4xl mx-auto">
			<h1 className="text-2xl font-bold">{title}</h1>
			{subtitle && <p className="mt-1 text-sm" style={{ color: '#8EADC4' }}>{subtitle}</p>}
		</div>
	</header>
);

export const ProfilePage: React.FC = () => {
	const [profile, setProfile] = useState<UserProfile | null>(null);
	const [firstName, setFirstName] = useState('');
	const [lastName, setLastName] = useState('');

	const [currentPassword, setCurrentPassword] = useState('');
	const [newPassword, setNewPassword] = useState('');

	const [loadingProfile, setLoadingProfile] = useState(true);
	const [savingProfile, setSavingProfile] = useState(false);
	const [changingPassword, setChangingPassword] = useState(false);

	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const logout = useAuthStore((s) => s.logout);

	useEffect(() => {
		let mounted = true;
		usersApi
			.getMe()
			.then((p) => {
				if (!mounted) return;
				setProfile(p);
				setFirstName(p.first_name ?? '');
				setLastName(p.last_name ?? '');
			})
			.catch(() => {
				if (!mounted) return;
				setError('Failed to load profile');
			})
			.finally(() => mounted && setLoadingProfile(false));

		return () => {
			mounted = false;
		};
	}, []);

	const getErrorMessage = (err: unknown, fallback: string) => {
		if (typeof err === 'object' && err !== null && 'response' in err) {
			const response = (err as { response?: { data?: { detail?: string } } }).response;
			return response?.data?.detail ?? fallback;
		}

		return fallback;
	};

	const onSaveProfile = async (e?: React.FormEvent) => {
		e?.preventDefault();
		setSavingProfile(true);
		setMessage(null);
		setError(null);

		try {
			const updated = await usersApi.updateProfile({ first_name: firstName, last_name: lastName });
			setProfile(updated);
			setMessage('Profile updated');
		} catch (err: unknown) {
			setError(getErrorMessage(err, 'Failed to update profile'));
		} finally {
			setSavingProfile(false);
		}
	};

	const onChangePassword = async (e: React.FormEvent) => {
		e.preventDefault();
		setChangingPassword(true);
		setMessage(null);
		setError(null);

		if (newPassword.length < 8) {
			setError('New password must be at least 8 characters');
			setChangingPassword(false);
			return;
		}

		try {
			await usersApi.changePassword(currentPassword, newPassword);
			// Backend should revoke refresh tokens; log the user out so they must re-authenticate
			setMessage('Password changed — you will be signed out');
			// small delay so message is visible
			setTimeout(() => logout(), 1200);
		} catch (err: unknown) {
			setError(getErrorMessage(err, 'Failed to change password'));
		} finally {
			setChangingPassword(false);
			setCurrentPassword('');
			setNewPassword('');
		}
	};

	return (
		<div className="min-h-screen" style={{ background: '#F2F2F2' }}>
			<BrandHeader title="My profile" subtitle="Keep your account information up to date and secure" />

			<main className="max-w-4xl mx-auto px-4">
				<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
					<section className="bg-white rounded-md p-6 shadow-sm border">
						<h2 className="text-lg font-semibold mb-4">Profile</h2>
						{loadingProfile ? (
							<p>Loading…</p>
						) : (
							<form onSubmit={onSaveProfile}>
								<label className="block text-sm font-medium text-gray-700">First name</label>
								<input
									className="mt-1 w-full p-2 border rounded-md"
									value={firstName}
									onChange={(e) => setFirstName(e.target.value)}
								/>

								<label className="block text-sm font-medium text-gray-700 mt-4">Last name</label>
								<input
									className="mt-1 w-full p-2 border rounded-md"
									value={lastName}
									onChange={(e) => setLastName(e.target.value)}
								/>

								<div className="mt-4 flex items-center gap-3">
									<button
										type="submit"
										className="px-4 py-2 rounded-md text-white"
										style={{ background: '#0070BF' }}
										disabled={savingProfile}
									>
										{savingProfile ? 'Saving…' : 'Save'}
									</button>
									<button
										type="button"
										className="px-3 py-2 rounded-md border"
										onClick={() => {
											setFirstName(profile?.first_name ?? '');
											setLastName(profile?.last_name ?? '');
											setMessage(null);
											setError(null);
										}}
									>
										Reset
									</button>
								</div>
							</form>
						)}
					</section>

					<section className="bg-white rounded-md p-6 shadow-sm border">
						<h2 className="text-lg font-semibold mb-4">Change password</h2>
						<form onSubmit={onChangePassword}>
							<label className="block text-sm font-medium text-gray-700">Current password</label>
							<input
								type="password"
								className="mt-1 w-full p-2 border rounded-md"
								value={currentPassword}
								onChange={(e) => setCurrentPassword(e.target.value)}
							/>

							<label className="block text-sm font-medium text-gray-700 mt-4">New password</label>
							<input
								type="password"
								className="mt-1 w-full p-2 border rounded-md"
								value={newPassword}
								onChange={(e) => setNewPassword(e.target.value)}
							/>
							<p className="text-xs text-gray-500 mt-2">New password must be at least 8 characters.</p>

							<div className="mt-4">
								<button
									type="submit"
									className="px-4 py-2 rounded-md text-white"
									style={{ background: '#C00000' }}
									disabled={changingPassword}
								>
									{changingPassword ? 'Changing…' : 'Change password'}
								</button>
							</div>
						</form>
					</section>
				</div>

				{message && (
					<div className="mt-6 p-3 rounded-md text-green-800 bg-green-50 border" role="status">
						{message}
					</div>
				)}

				{error && (
					<div className="mt-6 p-3 rounded-md text-red-800 bg-red-50 border" role="alert">
						{error}
					</div>
				)}
			</main>
		</div>
	);
};

export default ProfilePage;
