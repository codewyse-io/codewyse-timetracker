import { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Upload, message, Spin, ColorPicker, Select } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { useOrg } from '../contexts/OrgContext';
import { organizationsApi } from '../api/organizations.api';

export default function OrganizationSettings() {
  const { org, loading, refreshOrg } = useOrg();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (org) {
      form.setFieldsValue({
        name: org.name,
        primaryColor: org.primaryColor,
        emailFromName: org.emailFromName,
        currency: org.currency || 'USD',
        currencySymbol: org.currencySymbol || '$',
      });
    }
  }, [org, form]);

  const handleSave = async (values: { name: string; primaryColor: string; emailFromName: string; currency: string; currencySymbol: string }) => {
    setSaving(true);
    try {
      const color = typeof values.primaryColor === 'string'
        ? values.primaryColor
        : (values.primaryColor as any)?.toHexString?.() ?? org?.primaryColor ?? '#6366f1';

      await organizationsApi.updateCurrent({
        name: values.name,
        primaryColor: color,
        emailFromName: values.emailFromName,
        currency: values.currency,
        currencySymbol: values.currencySymbol,
      });
      await refreshOrg();
      message.success('Organization settings updated successfully');
    } catch {
      message.error('Failed to update organization settings');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (file: File) => {
    setUploading(true);
    try {
      await organizationsApi.uploadLogo(file);
      await refreshOrg();
      message.success('Logo uploaded successfully');
    } catch {
      message.error('Failed to upload logo');
    } finally {
      setUploading(false);
    }
    return false; // Prevent default upload behavior
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <Card title="Organization Settings" variant="borderless">
        {org?.logoUrl && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>Current Logo</div>
            <img
              src={org.logoUrl}
              alt="Organization logo"
              style={{
                width: 80,
                height: 80,
                borderRadius: 12,
                objectFit: 'cover',
                border: '1px solid var(--border-light)',
              }}
            />
          </div>
        )}

        <div style={{ marginBottom: 24 }}>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>Upload Logo</div>
          <Upload
            accept="image/*"
            showUploadList={false}
            beforeUpload={(file) => {
              handleLogoUpload(file);
              return false;
            }}
          >
            <Button icon={<UploadOutlined />} loading={uploading}>
              {uploading ? 'Uploading...' : 'Choose File'}
            </Button>
          </Upload>
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
        >
          <Form.Item
            name="name"
            label="Organization Name"
            rules={[{ required: true, message: 'Please enter the organization name' }]}
          >
            <Input placeholder="Enter organization name" />
          </Form.Item>

          <Form.Item
            name="primaryColor"
            label="Primary Color"
          >
            <ColorPicker format="hex" showText />
          </Form.Item>

          <Form.Item
            name="emailFromName"
            label="Email Sender Name"
            rules={[{ required: true, message: 'Please enter the email sender name' }]}
          >
            <Input placeholder="Enter email sender name" />
          </Form.Item>

          <Form.Item
            name="currency"
            label="Currency Code"
            rules={[{ required: true, message: 'Please select a currency code' }]}
          >
            <Select
              placeholder="Select currency code"
              options={[
                { value: 'USD', label: 'USD - US Dollar' },
                { value: 'EUR', label: 'EUR - Euro' },
                { value: 'GBP', label: 'GBP - British Pound' },
                { value: 'PKR', label: 'PKR - Pakistani Rupee' },
                { value: 'INR', label: 'INR - Indian Rupee' },
                { value: 'AED', label: 'AED - UAE Dirham' },
                { value: 'SAR', label: 'SAR - Saudi Riyal' },
                { value: 'CAD', label: 'CAD - Canadian Dollar' },
                { value: 'AUD', label: 'AUD - Australian Dollar' },
              ]}
            />
          </Form.Item>

          <Form.Item
            name="currencySymbol"
            label="Currency Symbol"
            rules={[{ required: true, message: 'Please enter the currency symbol' }]}
          >
            <Input placeholder="e.g. $, €, £, ₨" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={saving}>
              Save Changes
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
