// screens/PasswordSecurity.jsx
import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  TextInput,
  View,
  Text,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
  Switch,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import api from "../lib/api";
import { UserContext } from "./UserContext";
import { useTheme } from "./contexts/ThemeContext";
import styles, { COLORS } from "../Designs/PasswordSecurity";
import { getPasswordError, getPasswordRequirements } from "./utils/validation";
import useFormAutoScroll from "./hooks/useFormAutoScroll";
import useDeadlineCountdown from "./hooks/useDeadlineCountdown";

function getUserId(user) {
  return user?._id || user?.id || user?.userId || "";
}

export default function PasswordSecurity({ navigation }) {
  const { user, setUser } = useContext(UserContext);
  const { theme } = useTheme();
  const themed = useMemo(() => createPasswordThemeStyles(theme), [theme]);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [newPasswordError, setNewPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(
    Boolean(user?.twoFactorEnabled)
  );

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [submitError, setSubmitError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isToggling2FA, setIsToggling2FA] = useState(false);
  const [contactStatus, setContactStatus] = useState(null);
  const [isLoadingContacts, setIsLoadingContacts] = useState(true);
  const [contactError, setContactError] = useState("");
  const [verificationChannel, setVerificationChannel] = useState("");
  const [verificationDestination, setVerificationDestination] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationError, setVerificationError] = useState("");
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [resendSeconds, setResendSeconds] = useDeadlineCountdown(0);

  const userId = getUserId(user);

  const {
    scrollRef,
    contentRef,
    registerField,
    scrollToInput,
    handleScroll,
  } = useFormAutoScroll(230);

  const loadContactStatus = useCallback(async () => {
    try {
      setContactError("");
      const response = await api.get("/user/me/contact-verification");
      setContactStatus(response?.data || null);
    } catch (error) {
      setContactError(
        error?.response?.data?.message || "Unable to load contact verification status."
      );
    } finally {
      setIsLoadingContacts(false);
    }
  }, []);

  useEffect(() => {
    loadContactStatus();
  }, [loadContactStatus]);

  const sendContactCode = async (channel, isResend = false) => {
    if (isSendingCode || isVerifyingCode || (isResend && resendSeconds > 0)) return;
    setVerificationChannel(channel);
    setVerificationDestination(
      channel === "sms" ? contactStatus?.phoneMasked : contactStatus?.emailMasked
    );
    try {
      setIsSendingCode(true);
      setVerificationError("");
      const response = await api.post("/user/me/contact-verification/send-otp", { channel });
      setVerificationDestination(response?.data?.destination || "your registered contact");
      setVerificationCode("");
      setResendSeconds(response?.data?.resendAfterSeconds || 60);
    } catch (error) {
      setVerificationError(
        error?.response?.data?.message || "Unable to send the verification code."
      );
    } finally {
      setIsSendingCode(false);
    }
  };

  const verifyContactCode = async () => {
    if (isVerifyingCode || isSendingCode) return;
    if (!/^\d{6}$/.test(verificationCode)) {
      setVerificationError("Please enter the full 6-digit code.");
      return;
    }
    try {
      setIsVerifyingCode(true);
      setVerificationError("");
      const response = await api.post("/user/me/contact-verification/verify-otp", {
        channel: verificationChannel,
        otp: verificationCode,
      });
      const updatedUser = response?.data?.user;
      if (updatedUser) {
        await setUser({ ...user, ...updatedUser, _id: updatedUser._id || userId });
      }
      setContactStatus(response?.data?.contactVerification || contactStatus);
      setVerificationChannel("");
      setVerificationCode("");
      setResendSeconds(0);
      Alert.alert("Contact verified", response?.data?.message || "Contact verified successfully.");
    } catch (error) {
      setVerificationError(
        error?.response?.data?.message || "Unable to verify the code."
      );
    } finally {
      setIsVerifyingCode(false);
    }
  };

  const closeVerification = () => {
    if (isSendingCode || isVerifyingCode) return;
    setVerificationChannel("");
    setVerificationCode("");
    setVerificationError("");
  };

  const handleNewPassword = (text) => {
    const cleanText = text.trim();

    setNewPassword(cleanText);
    setSubmitError("");
    setNewPasswordError(getPasswordError(cleanText));

    if (confirmPassword && cleanText !== confirmPassword) {
      setConfirmPasswordError("Passwords do not match.");
    } else {
      setConfirmPasswordError("");
    }
  };

  const handleConfirmPassword = (text) => {
    const cleanText = text.trim();

    setConfirmPassword(cleanText);
    setSubmitError("");

    if (cleanText.length === 0) {
      setConfirmPasswordError("Confirm password is required.");
    } else if (cleanText !== newPassword) {
      setConfirmPasswordError("Passwords do not match.");
    } else {
      setConfirmPasswordError("");
    }
  };

  const updatePassword = async () => {
    const cleanCurrentPassword = currentPassword.trim();

    setSubmitError("");

    if (!userId) {
      setSubmitError("Missing user ID. Please log in again.");
      Alert.alert("Update failed", "Missing user ID. Please log in again.");
      return;
    }

    if (!cleanCurrentPassword || !newPassword || !confirmPassword) {
      setSubmitError("Missing Field");
      return;
    }

    const passwordError = getPasswordError(newPassword);
    if (passwordError) {
      setNewPasswordError(passwordError);
      setSubmitError("Please fix the password errors first.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setConfirmPasswordError("Passwords do not match.");
      setSubmitError("Passwords do not match.");
      return;
    }

    if (newPassword === cleanCurrentPassword) {
      setSubmitError("New password must be different from the current password.");
      return;
    }

    if (isSaving) return;

    try {
      setIsSaving(true);

      const response = await api.put(`/user/update/${userId}`, {
        currentPassword: cleanCurrentPassword,
        password: newPassword,
      });

      const updatedUser = response?.data || {};

      setUser({
        ...user,
        ...updatedUser,
        _id: updatedUser?._id || user?._id || userId,
        id: updatedUser?.id || user?.id || userId,
      });

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setNewPasswordError("");
      setConfirmPasswordError("");
      setSubmitError("");

      Alert.alert("Security updated", "Your password has been updated.");
    } catch (error) {
      console.log("Password update failed:", {
        url: `/user/update/${userId}`,
        message: error?.message,
        status: error?.response?.status,
        data: error?.response?.data,
      });

      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        "Failed to update password.";

      setSubmitError(message);
      Alert.alert("Update failed", message);
    } finally {
      setIsSaving(false);
    }
  };

  const toggle2FA = async (value) => {
    if (!userId || isToggling2FA) {
      if (!userId) {
        Alert.alert("Update failed", "Missing user ID. Please log in again.");
      }
      return;
    }

    const previousValue = twoFactorEnabled;

    try {
      setIsToggling2FA(true);
      setTwoFactorEnabled(value);

      await api.put(`/user/twofactor/${userId}`, {
        enabled: value,
      });

      setUser({
        ...user,
        _id: user?._id || userId,
        id: user?.id || userId,
        twoFactorEnabled: value,
      });
    } catch (err) {
      console.log("Two-factor update failed:", {
        url: `/user/twofactor/${userId}`,
        message: err?.message,
        status: err?.response?.status,
        data: err?.response?.data,
      });

      setTwoFactorEnabled(previousValue);

      Alert.alert(
        "Update failed",
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Unable to update two-factor authentication."
      );
    } finally {
      setIsToggling2FA(false);
    }
  };

  if (!user) return <Text>No user logged in</Text>;

  const matches = Boolean(confirmPassword && !confirmPasswordError);

  return (
    <KeyboardAvoidingView
      style={[styles.webFrame, themed.screen]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
    >
      <ScrollView
        ref={scrollRef}
        style={[styles.phone, themed.screen]}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 260 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        <View ref={contentRef} collapsable={false}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={21} color={theme.text} />
          </TouchableOpacity>

          <View style={styles.headerCopy}>
            <Text style={[styles.headerTitle, themed.text]}>Password & Security</Text>
          </View>

          <View style={styles.headerRightSpacer} />
        </View>

        <View style={styles.securityHero}>
          <View style={[styles.heroIcon, themed.softCard]}>
            <Ionicons
              name="shield-checkmark-outline"
              size={28}
              color={theme.primary}
            />
          </View>

          <View style={styles.heroCopy}>
            <Text style={[styles.heroTitle, themed.text]}>Set Your Password</Text>
            <Text style={[styles.heroText, themed.subtext]}>
              In order to keep your account safe you need
              to create a strong password.
            </Text>
          </View>
        </View>

        <View style={[styles.sectionCard, themed.card]}>
          <Text style={[styles.sectionTitle, themed.text]}>Password</Text>

          <PasswordField
            label="Current Password"
            value={currentPassword}
            onChangeText={(value) => {
              setCurrentPassword(value.trim());
              if (submitError) setSubmitError("");
            }}
            visible={showCurrentPassword}
            onToggleVisibility={() => setShowCurrentPassword((prev) => !prev)}
            theme={theme}
            themed={themed}
            fieldRef={registerField("currentPassword")}
            onFocus={() => scrollToInput("currentPassword")}
          />

          <PasswordField
            label="New Password"
            value={newPassword}
            onChangeText={handleNewPassword}
            visible={showNewPassword}
            onToggleVisibility={() => setShowNewPassword((prev) => !prev)}
            theme={theme}
            themed={themed}
            fieldRef={registerField("newPassword")}
            onFocus={() => scrollToInput("newPassword")}
          />

          {newPasswordError ? (
            <Text style={styles.error}>{newPasswordError}</Text>
          ) : null}

          <PasswordField
            label="Confirm Password"
            value={confirmPassword}
            onChangeText={handleConfirmPassword}
            visible={showConfirmPassword}
            onToggleVisibility={() => setShowConfirmPassword((prev) => !prev)}
            theme={theme}
            themed={themed}
            fieldRef={registerField("confirmPassword")}
            onFocus={() => scrollToInput("confirmPassword")}
          />

          {confirmPasswordError ? (
            <Text style={styles.error}>{confirmPasswordError}</Text>
          ) : null}

          {submitError ? <Text style={styles.error}>{submitError}</Text> : null}

          <View style={styles.ruleGrid}>
            <Text style={[styles.ruleHeader, themed.subtext]}>
              YOUR PASSWORD MUST CONTAIN
            </Text>
            {getPasswordRequirements(newPassword).map((item) => (
              <Rule key={item.key} checked={item.met} text={item.label} theme={theme} />
            ))}
            <Rule checked={matches} text="Matches" theme={theme} />
          </View>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.buttonPrimary }, isSaving && { opacity: 0.65 }]}
            onPress={updatePassword}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color={theme.buttonText} size="small" />
            ) : (
              <Text style={[styles.buttonText, { color: theme.buttonText }]}>Save Password</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={[styles.twoFAWrapper, themed.card]}>
          <View style={styles.twoFATop}>
            <View style={[styles.twoFAIcon, themed.softCard]}>
              <Ionicons name="checkmark-circle-outline" size={21} color={theme.primary} />
            </View>
            <View style={styles.twoFACopy}>
              <Text style={[styles.sectionTitle, themed.text]}>Contact Verification</Text>
              <Text style={[styles.subInfo, themed.subtext]}>
                Verify both contacts for secure account recovery.
              </Text>
            </View>
            {isLoadingContacts ? <ActivityIndicator color={theme.primary} size="small" /> : null}
          </View>

          {contactError ? (
            <View>
              <Text style={styles.error}>{contactError}</Text>
              <TouchableOpacity style={localStyles.retryButton} onPress={loadContactStatus}>
                <Text style={{ color: theme.primary, fontWeight: "900" }}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {contactStatus ? (
            <View style={localStyles.contactList}>
              <ContactVerificationRow
                icon="mail-outline"
                label="Email address"
                value={contactStatus.email}
                verified={contactStatus.isEmailVerified}
                actionLabel="Verify email address"
                busy={isSendingCode && verificationChannel === "email"}
                onVerify={() => sendContactCode("email")}
                theme={theme}
                themed={themed}
              />
              <ContactVerificationRow
                icon="phone-portrait-outline"
                label="Mobile number"
                value={contactStatus.phoneNumber ? `0${contactStatus.phoneNumber}` : "Not provided"}
                verified={contactStatus.isPhoneVerified}
                actionLabel="Verify mobile number"
                busy={isSendingCode && verificationChannel === "sms"}
                onVerify={() => sendContactCode("sms")}
                theme={theme}
                themed={themed}
              />
            </View>
          ) : null}
        </View>

        <View style={[styles.twoFAWrapper, themed.card]}>
          <View style={styles.twoFATop}>
            <View style={[styles.twoFAIcon, themed.softCard]}>
              <Ionicons name="key-outline" size={20} color={theme.primary} />
            </View>

            <View style={styles.twoFACopy}>
              <Text style={[styles.sectionTitle, themed.text]}>Two-Factor Authentication</Text>
              <Text style={[styles.subInfo, themed.subtext]}>
                Require a verification code when signing in.
              </Text>
            </View>

            <Switch
              value={twoFactorEnabled}
              onValueChange={toggle2FA}
              disabled={isToggling2FA}
            />
          </View>

          <Text style={[styles.status, twoFactorEnabled && styles.statusEnabled]}>
            {twoFactorEnabled ? "Enabled" : "Disabled"}
          </Text>
        </View>
        </View>
      </ScrollView>

      <Modal
        visible={Boolean(verificationChannel)}
        transparent
        animationType="slide"
        onRequestClose={closeVerification}
      >
        <KeyboardAvoidingView
          style={localStyles.modalBackdrop}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            style={[localStyles.modalCard, themed.card]}
            contentContainerStyle={localStyles.modalCardContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <TouchableOpacity
              style={localStyles.modalClose}
              onPress={closeVerification}
              disabled={isSendingCode || isVerifyingCode}
            >
              <Ionicons name="close" size={22} color={theme.text} />
            </TouchableOpacity>
            <View style={[styles.heroIcon, themed.softCard, localStyles.modalIcon]}>
              <Ionicons name="shield-checkmark-outline" size={28} color={theme.primary} />
            </View>
            <Text style={[localStyles.modalTitle, themed.text]}>
              Verify {verificationChannel === "sms" ? "mobile number" : "email address"}
            </Text>
            <Text style={[localStyles.modalCopy, themed.subtext]}>
              Enter the 6-digit code sent to {verificationDestination}.
            </Text>
            <TextInput
              style={[styles.input, localStyles.codeInput, themed.input]}
              value={verificationCode}
              onChangeText={(value) => {
                setVerificationCode(String(value || "").replace(/\D/g, "").slice(0, 6));
                setVerificationError("");
              }}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="000000"
              placeholderTextColor={theme.subtext}
              textAlign="center"
              autoFocus
            />
            {verificationError ? <Text style={styles.error}>{verificationError}</Text> : null}
            <TouchableOpacity
              style={[
                styles.button,
                { backgroundColor: theme.buttonPrimary },
                (verificationCode.length !== 6 || isVerifyingCode) && localStyles.disabled,
              ]}
              onPress={verifyContactCode}
              disabled={verificationCode.length !== 6 || isVerifyingCode || isSendingCode}
            >
              {isVerifyingCode ? (
                <ActivityIndicator color={theme.buttonText} size="small" />
              ) : (
                <Text style={[styles.buttonText, { color: theme.buttonText }]}>Verify</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={localStyles.resendButton}
              onPress={() => sendContactCode(verificationChannel, true)}
              disabled={resendSeconds > 0 || isSendingCode || isVerifyingCode}
            >
              {isSendingCode ? (
                <ActivityIndicator color={theme.primary} size="small" />
              ) : (
                <Text style={{ color: resendSeconds > 0 ? theme.subtext : theme.primary, fontWeight: "900" }}>
                  {resendSeconds > 0 ? `Resend code in ${resendSeconds}s` : "Resend code"}
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function ContactVerificationRow({ icon, label, value, verified, actionLabel, busy, onVerify, theme, themed }) {
  return (
    <View style={[localStyles.contactRow, { borderColor: theme.border }]}>
      <View style={localStyles.contactHeader}>
        <Ionicons name={icon} size={18} color={theme.primary} />
        <View style={localStyles.contactCopy}>
          <Text style={[localStyles.contactLabel, themed.text]}>{label}</Text>
          <Text style={[localStyles.contactValue, themed.subtext]} numberOfLines={1}>{value || "Not provided"}</Text>
        </View>
        <View style={[localStyles.verificationBadge, verified ? localStyles.verifiedBadge : localStyles.unverifiedBadge]}>
          <Text style={verified ? localStyles.verifiedText : localStyles.unverifiedText}>
            {verified ? "✓ Verified" : "Not verified"}
          </Text>
        </View>
      </View>
      {!verified && value ? (
        <TouchableOpacity style={[localStyles.verifyButton, { backgroundColor: theme.primary }]} onPress={onVerify} disabled={busy}>
          {busy ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={localStyles.verifyButtonText}>{actionLabel}</Text>}
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function PasswordField({
  label,
  value,
  onChangeText,
  visible,
  onToggleVisibility,
  theme,
  themed,
  fieldRef,
  onFocus,
}) {
  return (
    <View ref={fieldRef} collapsable={false} style={styles.inputWrap}>
      <Text style={[styles.inputLabel, themed.text]}>{label}</Text>

      <View style={localStyles.passwordFieldShell}>
        <TextInput
          style={[styles.input, localStyles.passwordInput, themed.input]}
          placeholder={label}
          placeholderTextColor={theme.subtext}
          secureTextEntry={!visible}
          value={value}
          onChangeText={onChangeText}
          onFocus={onFocus}
        />

        <TouchableOpacity
          style={localStyles.passwordToggle}
          onPress={onToggleVisibility}
          activeOpacity={0.82}
        >
          <Ionicons
            name={visible ? "eye-off-outline" : "eye-outline"}
            size={18}
            color={theme.primary}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Rule({ checked, text, theme }) {
  const color = checked ? theme.primary : theme.danger;

  return (
    <View style={styles.rulePill}>
      <View style={[styles.ruleDot, { backgroundColor: color }]} />
      <Text style={[styles.ruleText, { color: theme.subtext }, checked && { color: theme.text }]}>
        {text}
      </Text>
    </View>
  );
}

const localStyles = StyleSheet.create({
  contactList: { marginTop: 14, gap: 10 },
  contactRow: { borderTopWidth: 1, paddingTop: 12 },
  contactHeader: { flexDirection: "row", alignItems: "center" },
  contactCopy: { flex: 1, marginLeft: 10, marginRight: 8 },
  contactLabel: { fontSize: 12, fontWeight: "900" },
  contactValue: { marginTop: 3, fontSize: 12, fontWeight: "600" },
  verificationBadge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  verifiedBadge: { backgroundColor: "#DCFCE7" },
  unverifiedBadge: { backgroundColor: "#FEF3C7" },
  verifiedText: { color: "#166534", fontSize: 10, fontWeight: "900" },
  unverifiedText: { color: "#92400E", fontSize: 10, fontWeight: "900" },
  verifyButton: { minHeight: 40, borderRadius: 999, alignItems: "center", justifyContent: "center", marginTop: 10 },
  verifyButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  retryButton: { alignSelf: "flex-start", marginTop: 8, paddingVertical: 5 },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.48)" },
  modalCard: { maxHeight: "88%", borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1 },
  modalCardContent: { paddingHorizontal: 22, paddingTop: 26, paddingBottom: Platform.OS === "ios" ? 38 : 26 },
  modalClose: { position: "absolute", right: 16, top: 14, width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", zIndex: 2 },
  modalIcon: { alignSelf: "center", width: 64, height: 64, borderRadius: 22, marginBottom: 14 },
  modalTitle: { textAlign: "center", fontSize: 20, fontWeight: "900" },
  modalCopy: { marginTop: 8, textAlign: "center", fontSize: 13, lineHeight: 19, fontWeight: "600" },
  codeInput: { marginTop: 22, fontSize: 22, fontWeight: "900", letterSpacing: 10, paddingLeft: 26 },
  resendButton: { minHeight: 44, alignItems: "center", justifyContent: "center", marginTop: 8 },
  disabled: { opacity: 0.55 },
  passwordFieldShell: {
    position: "relative",
    justifyContent: "center",
  },
  passwordInput: {
    paddingRight: 48,
  },
  passwordToggle: {
    position: "absolute",
    right: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
});

function createPasswordThemeStyles(theme) {
  return StyleSheet.create({
    screen: {
      backgroundColor: theme.background,
    },
    card: {
      backgroundColor: theme.card,
      borderColor: theme.border,
    },
    softCard: {
      backgroundColor: theme.primarySoft,
      borderColor: theme.border,
    },
    text: {
      color: theme.text,
    },
    subtext: {
      color: theme.subtext,
    },
    input: {
      backgroundColor: theme.inputBackground,
      borderColor: theme.border,
      color: theme.text,
    },
  });
}
