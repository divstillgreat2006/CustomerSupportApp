import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

const CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

const EMAILJS_SERVICE_ID = process.env.EXPO_PUBLIC_EMAILJS_SERVICE_ID;
const EMAILJS_TEMPLATE_ID = process.env.EXPO_PUBLIC_EMAILJS_TEMPLATE_ID;
const EMAILJS_PUBLIC_KEY = process.env.EXPO_PUBLIC_EMAILJS_PUBLIC_KEY;

export default function CustomerSupportScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState('Technical Issue');
  const [message, setMessage] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageName, setImageName] = useState('screenshot.jpg');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');

  const showMessage = (title: string, text: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${text}`);
    } else {
      Alert.alert(title, text);
    }
  };

  const chooseImage = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        showMessage(
          'Permission needed',
          'Please allow access to your photos to attach a screenshot.',
        );
        return;
      }

      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });

      if (!picked.canceled && picked.assets.length > 0) {
        const asset = picked.assets[0];
        setImageUri(asset.uri);
        setImageName(asset.fileName || 'screenshot.jpg');
        setResult('');
      }
    } catch {
      showMessage('Error', 'Could not select the screenshot.');
    }
  };

  const uploadToCloudinary = async (uri: string): Promise<string> => {
    if (!CLOUD_NAME || !UPLOAD_PRESET) {
      throw new Error('Cloudinary configuration is missing in .env.');
    }

    const formData = new FormData();

    if (Platform.OS === 'web') {
      const response = await fetch(uri);

      if (!response.ok) {
        throw new Error('Could not read the selected screenshot.');
      }

      const blob = await response.blob();
      formData.append('file', blob, imageName);
    } else {
      formData.append(
        'file',
        {
          uri,
          name: imageName,
          type: 'image/jpeg',
        } as any,
      );
    }

    formData.append('upload_preset', UPLOAD_PRESET);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
      {
        method: 'POST',
        body: formData,
      },
    );

    const data = await response.json();

    if (!response.ok || !data.secure_url) {
      throw new Error(data.error?.message || 'Screenshot upload failed.');
    }

    return data.secure_url;
  };

  const sendSupportEmail = async (imageUrl: string) => {
    if (
      !EMAILJS_SERVICE_ID ||
      !EMAILJS_TEMPLATE_ID ||
      !EMAILJS_PUBLIC_KEY
    ) {
      throw new Error('EmailJS configuration is missing in .env.');
    }

    const response = await fetch(
      'https://api.emailjs.com/api/v1.0/email/send',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          service_id: EMAILJS_SERVICE_ID,
          template_id: EMAILJS_TEMPLATE_ID,
          user_id: EMAILJS_PUBLIC_KEY,
          template_params: {
            name: name.trim(),
            reply_to: email.trim(),
            issue_category: category,
            message: message.trim(),
            image_url: imageUrl,
          },
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Email could not be sent.');
    }
  };

  const submitForm = async () => {
    if (loading) return;

    if (!name.trim() || !email.trim() || !message.trim()) {
      showMessage(
        'Missing information',
        'Please enter your name, email, and message.',
      );
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email.trim())) {
      showMessage('Invalid email', 'Please enter a valid email address.');
      return;
    }

    if (!imageUri) {
      showMessage(
        'Screenshot required',
        'Please select a screenshot before submitting.',
      );
      return;
    }

    if (
      !CLOUD_NAME ||
      !UPLOAD_PRESET ||
      !EMAILJS_SERVICE_ID ||
      !EMAILJS_TEMPLATE_ID ||
      !EMAILJS_PUBLIC_KEY
    ) {
      showMessage(
        'Configuration missing',
        'Please check your Cloudinary and EmailJS settings in .env.',
      );
      return;
    }

    setLoading(true);
    setResult('');

    let uploadedUrl = '';

    try {
      // Upload the screenshot first.
      uploadedUrl = await uploadToCloudinary(imageUri);

      // Send the email only after the upload succeeds.
      await sendSupportEmail(uploadedUrl);

      setResult('Success! Your support request and screenshot were sent.');
      showMessage(
        'Submission successful!',
        'Your support request was emailed successfully, and your screenshot was uploaded.',
      );

      setName('');
      setEmail('');
      setCategory('Technical Issue');
      setMessage('');
      setImageUri(null);
      setImageName('screenshot.jpg');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Something went wrong.';

      if (uploadedUrl) {
        setResult(
          `Screenshot uploaded, but the email failed. Screenshot URL: ${uploadedUrl}`,
        );
        showMessage(
          'Email failed',
          `Your screenshot uploaded successfully, but the email was not sent.\n\n${errorMessage}`,
        );
      } else {
        setResult(`Submission failed: ${errorMessage}`);
        showMessage('Upload failed', errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text style={styles.title}>Customer Support</Text>
        <Text style={styles.subtitle}>
          Tell us about your concern. Attach a screenshot to help us assist you.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Full Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your name"
          value={name}
          onChangeText={setName}
          editable={!loading}
        />

        <Text style={styles.label}>Email Address *</Text>
        <TextInput
          style={styles.input}
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!loading}
        />

        <Text style={styles.label}>Issue Category *</Text>
        <View style={styles.categoryList}>
          {['Technical Issue', 'Account', 'Billing', 'Other'].map((item) => (
            <TouchableOpacity
              key={item}
              style={[
                styles.categoryButton,
                category === item && styles.categorySelected,
              ]}
              onPress={() => setCategory(item)}
              disabled={loading}
            >
              <Text
                style={[
                  styles.categoryText,
                  category === item && styles.categoryTextSelected,
                ]}
              >
                {item}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Message *</Text>
        <TextInput
          style={[styles.input, styles.messageInput]}
          placeholder="Describe your concern..."
          value={message}
          onChangeText={setMessage}
          multiline
          textAlignVertical="top"
          editable={!loading}
        />

        <Text style={styles.label}>Screenshot *</Text>
        <Text style={styles.helper}>
          Choose an image to upload with your support request.
        </Text>

        {imageUri ? (
          <View style={styles.previewContainer}>
            <Image source={{ uri: imageUri }} style={styles.preview} />
            <Text style={styles.fileName} numberOfLines={1}>
              {imageName}
            </Text>
            <View style={styles.imageActions}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={chooseImage}
                disabled={loading}
              >
                <Text style={styles.secondaryButtonText}>Change Screenshot</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => setImageUri(null)}
                disabled={loading}
              >
                <Text style={styles.removeButtonText}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.chooseButton}
            onPress={chooseImage}
            disabled={loading}
          >
            <Text style={styles.chooseButtonText}>＋ Choose Screenshot</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.submitButton, loading && styles.disabledButton]}
          onPress={submitForm}
          disabled={loading}
        >
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#ffffff" />
              <Text style={styles.submitButtonText}>Please wait...</Text>
            </View>
          ) : (
            <Text style={styles.submitButtonText}>Upload & Submit</Text>
          )}
        </TouchableOpacity>

        {!!result && <Text style={styles.result}>{result}</Text>}
      </View>

      <Text style={styles.footer}>
        * Required fields
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f3f6fb',
  },
  container: {
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
    padding: 20,
    paddingTop: 36,
    paddingBottom: 48,
  },
  header: {
    marginBottom: 22,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#183153',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: '#64748b',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#253449',
    marginTop: 16,
    marginBottom: 8,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1e293b',
    backgroundColor: '#ffffff',
  },
  messageInput: {
    minHeight: 120,
  },
  categoryList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryButton: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  categorySelected: {
    backgroundColor: '#e0ecff',
    borderColor: '#2563eb',
  },
  categoryText: {
    fontSize: 13,
    color: '#475569',
  },
  categoryTextSelected: {
    color: '#1d4ed8',
    fontWeight: '600',
  },
  helper: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 10,
  },
  chooseButton: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#2563eb',
    borderRadius: 10,
    padding: 18,
    alignItems: 'center',
    backgroundColor: '#f8fbff',
  },
  chooseButtonText: {
    color: '#1d4ed8',
    fontSize: 15,
    fontWeight: '600',
  },
  previewContainer: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10,
  },
  preview: {
    width: '100%',
    height: 200,
    resizeMode: 'contain',
    backgroundColor: '#f8fafc',
  },
  fileName: {
    marginTop: 8,
    color: '#475569',
    fontSize: 13,
  },
  imageActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  secondaryButton: {
    backgroundColor: '#e0ecff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  secondaryButtonText: {
    color: '#1d4ed8',
    fontWeight: '600',
  },
  removeButton: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  removeButtonText: {
    color: '#b91c1c',
    fontWeight: '600',
  },
  submitButton: {
    marginTop: 24,
    backgroundColor: '#2563eb',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.65,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  result: {
    marginTop: 16,
    fontSize: 13,
    lineHeight: 20,
    color: '#334155',
  },
  footer: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 14,
    textAlign: 'center',
  },
});
