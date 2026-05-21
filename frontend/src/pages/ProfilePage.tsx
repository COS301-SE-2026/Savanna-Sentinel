import React, { useEffect, useState } from 'react';
import { usersApi } from '@/services/usersApi';
import type { UserResponse } from '@/services/usersApi';
import { useAuthStore } from '@/store/authStore';

export const ProfilePage: React.FC = () => {
	const [profile, setProfile] = useState<UserResponse | null>(null);
	const [firstName, setFirstName] = useState('');
	const [lastName, setLastName] = useState('');

	const [currentPassword, setCurrentPassword] = useState('');
	const [newPassword, setNewPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');

	const [loadingProfile, setLoadingProfile] = useState(true);
	const [savingProfile, setSavingProfile] = useState(false);
	const [changingPassword, setChangingPassword] = useState(false);

	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const logout = useAuthStore((s) => s.logout);
	const profileFirstName = profile?.first_name ?? '';
	const profileLastName = profile?.last_name ?? '';
	const hasAnyProfileName = firstName.trim() !== '' || lastName.trim() !== '';
	const isProfileDirty =
		!loadingProfile &&
		(firstName.trim() !== profileFirstName.trim() || lastName.trim() !== profileLastName.trim());
	const isSaveDisabled = savingProfile || !isProfileDirty || !hasAnyProfileName;
	const isResetDisabled = !isProfileDirty;
	const canChangePassword =
		currentPassword.trim() !== '' &&
		newPassword.trim() !== '' &&
		confirmPassword.trim() !== '' &&
		currentPassword.length >= 8 &&
		newPassword.length >= 8 &&
		currentPassword !== newPassword &&
		newPassword === confirmPassword;

	const isChangePasswordDisabled = changingPassword || !canChangePassword;

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
		if (typeof err === 'object' && err !== null) {
			type ErrWithResponse = { response?: { data?: unknown }; message?: string };
			const e = err as ErrWithResponse;
			if (e.response && typeof e.response === 'object' && e.response.data && typeof e.response.data === 'object') {
				const data = e.response.data as Record<string, unknown>;
				if (typeof data.detail === 'string') return data.detail;
				if (typeof data.message === 'string') return data.message;
			}
			if (typeof e.message === 'string') return e.message;
		}

		return fallback;
	};

	const onSaveProfile = async (e?: React.FormEvent) => {
		e?.preventDefault();
		setSavingProfile(true);
		setMessage(null);
		setError(null);

		try {
			const payload: { first_name?: string; last_name?: string } = {};
			const fn = firstName.trim();
			const ln = lastName.trim();
			if (fn !== '') payload.first_name = fn;
			if (ln !== '') payload.last_name = ln;

			const updated = await usersApi.updateProfile(payload);
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
		if (!canChangePassword) {
			return;
		}

		setChangingPassword(true);
		setMessage(null);
		setError(null);

		const currentPasswordShort = currentPassword.length < 8;
		const newPasswordShort = newPassword.length < 8;

		if (currentPasswordShort || newPasswordShort) {
			if (currentPasswordShort && newPasswordShort) {
				setError('Current and new password must be at least 8 characters');
			} else if (currentPasswordShort) {
				setError('Current password cannot be less than 8 characters');
			} else {
				setError('New password cannot be less than 8 characters');
			}
			setChangingPassword(false);
			return;
		}

		if (currentPassword === newPassword) {
			setError('Current and New password cannot be the same');
			setChangingPassword(false);
			return;
		}

		if (newPassword !== confirmPassword) {
			setError('New password and confirm password must match');
			setChangingPassword(false);
			return;
		}

		try {
			await usersApi.changePassword(currentPassword, newPassword);
			// Log the user out so they must re-authenticate
			setMessage('Password changed — you will be signed out...');
			setChangingPassword(false);
			setTimeout(() => logout(), 1500);
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
			<main className="max-w-4xl mx-auto px-4">
				<div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-8">
					<section className="bg-white rounded-md p-6 shadow-sm border">
						<h2 className="text-lg font-semibold mb-4">Profile</h2>
						{loadingProfile ? (
							<p>Loading…</p>
						) : (
							<form onSubmit={onSaveProfile}>
								<label htmlFor="first_name" className="block text-sm font-medium text-gray-700">First name</label>
								<input
									id="first_name"
									className="mt-1 w-full p-2 border rounded-md"
									value={firstName}
									onChange={(e) => setFirstName(e.target.value)}
								/>

								<label htmlFor="last_name" className="block text-sm font-medium text-gray-700 mt-4">Last name</label>
								<input
									id="last_name"
									className="mt-1 w-full p-2 border rounded-md"
									value={lastName}
									onChange={(e) => setLastName(e.target.value)}
								/>

								<div className="mt-4 flex items-center gap-3 pt-2">
									<button
										type="submit"
										className="px-4 py-2 rounded-md text-white transition-colors"
										style={{
											background: isSaveDisabled ? '#103364' : '#0070BF',
											opacity: isSaveDisabled ? 0.72 : 1,
											cursor: isSaveDisabled ? 'not-allowed' : 'pointer',
											transition: 'background-color 180ms ease, color 180ms ease, opacity 180ms ease, transform 180ms ease, box-shadow 180ms ease',
										}}
										disabled={isSaveDisabled}
									>
										{savingProfile ? 'Save' : 'Save'}
									</button>
									<button
										type="button"
										className="px-3 py-2 rounded-md border transition-colors"
										style={{
											background: isResetDisabled ? '#F3F4F6' : '#FFFFFF',
											borderColor: isResetDisabled ? '#D1D5DB' : '#D1D5DB',
											color: isResetDisabled ? '#9CA3AF' : '#111827',
											opacity: isResetDisabled ? 0.8 : 1,
											cursor: isResetDisabled ? 'not-allowed' : 'pointer',
											transition: 'background-color 180ms ease, color 180ms ease, border-color 180ms ease, opacity 180ms ease, transform 180ms ease, box-shadow 180ms ease',
										}}
										disabled={isResetDisabled}
										onClick={() => {
											setFirstName(profileFirstName);
											setLastName(profileLastName);
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
								<label htmlFor="current_password" className="block text-sm font-medium text-gray-700">Current password</label>
							<input
									id="current_password"
								type="password"
								className="mt-1 w-full p-2 border rounded-md"
								value={currentPassword}
								onChange={(e) => setCurrentPassword(e.target.value)}
							/>

								<label htmlFor="new_password" className="block text-sm font-medium text-gray-700 mt-4">New password</label>
							<input
									id="new_password"
								type="password"
								className="mt-1 w-full p-2 border rounded-md"
								value={newPassword}
									onChange={(e) => {
										setNewPassword(e.target.value);
										setError(null);
									}}
							/>
							<p className="text-xs text-gray-500 mt-2">New password must be at least 8 characters.</p>

								<label htmlFor="confirm_password" className="block text-sm font-medium text-gray-700 mt-4">Confirm password</label>
								<input
									id="confirm_password"
									type="password"
									className="mt-1 w-full p-2 border rounded-md"
									value={confirmPassword}
									onChange={(e) => {
										setConfirmPassword(e.target.value);
										setError(null);
									}}
								/>

							<div className="mt-4">
								<button
									type="submit"
									className="px-4 py-2 rounded-md text-white transition-colors"
									style={{
										background: isChangePasswordDisabled ? '#7F1D1D' : '#C00000',
										opacity: isChangePasswordDisabled ? 0.72 : 1,
										cursor: isChangePasswordDisabled ? 'not-allowed' : 'pointer',
										transition: 'background-color 180ms ease, color 180ms ease, opacity 180ms ease, transform 180ms ease, box-shadow 180ms ease',
									}}
									disabled={isChangePasswordDisabled}
								>
									{changingPassword ? 'Change password' : 'Change password'}
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
