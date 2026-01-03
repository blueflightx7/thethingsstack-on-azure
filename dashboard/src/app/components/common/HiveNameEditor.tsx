'use client';

import { useState, useRef, useEffect } from 'react';
import { makeStyles, shorthands } from '@griffel/react';
import { Input } from '@fluentui/react-input';
import { Button } from '@fluentui/react-button';
import { Spinner } from '@fluentui/react-spinner';
import { Text } from '@fluentui/react-text';
import { tokens } from '@fluentui/react-theme';
import { 
  Edit20Regular, 
  Checkmark20Regular, 
  Dismiss20Regular,
} from '@fluentui/react-icons';
import { fetchJson } from '../../lib/api';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('8px'),
  },
  nameDisplay: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('8px'),
    cursor: 'pointer',
    ':hover': {
      '& .edit-icon': {
        opacity: 1,
      },
    },
  },
  editIcon: {
    opacity: 0,
    transition: 'opacity 0.2s ease',
    color: tokens.colorNeutralForeground3,
    cursor: 'pointer',
    ':hover': {
      color: tokens.colorBrandForeground1,
    },
  },
  editForm: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('4px'),
  },
  input: {
    minWidth: '150px',
  },
  error: {
    color: tokens.colorPaletteRedForeground1,
    fontSize: tokens.fontSizeBase200,
    marginTop: '4px',
  },
  subtext: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
});

interface HiveNameEditorProps {
  deviceId: string;
  currentName: string | null | undefined;
  deviceEui?: string;
  onSave?: (newName: string) => void;
  onCancel?: () => void;
  showDeviceId?: boolean;
  editable?: boolean;
}

export function HiveNameEditor({
  deviceId,
  currentName,
  deviceEui,
  onSave,
  onCancel,
  showDeviceId = false,
  editable = true,
}: HiveNameEditorProps) {
  const styles = useStyles();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(currentName ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Update edit value when current name changes
  useEffect(() => {
    if (!isEditing) {
      setEditValue(currentName ?? '');
    }
  }, [currentName, isEditing]);

  const displayName = currentName || deviceEui || deviceId || 'Unnamed Hive';

  const handleStartEdit = () => {
    if (!editable) return;
    setIsEditing(true);
    setEditValue(currentName ?? '');
    setError(null);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditValue(currentName ?? '');
    setError(null);
    onCancel?.();
  };

  const handleSave = async () => {
    const trimmedValue = editValue.trim();
    
    if (!trimmedValue) {
      setError('Name cannot be empty');
      return;
    }

    if (trimmedValue.length > 100) {
      setError('Name must be 100 characters or less');
      return;
    }

    if (trimmedValue === currentName) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Call API to update name
      await fetchJson(`/api/devices/${encodeURIComponent(deviceId)}/name`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: trimmedValue }),
      });

      onSave?.(trimmedValue);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save name');
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div>
        <div className={styles.editForm}>
          <Input
            ref={inputRef}
            className={styles.input}
            value={editValue}
            onChange={(e, data) => setEditValue(data.value)}
            onKeyDown={handleKeyDown}
            disabled={isSaving}
            placeholder="Enter hive name"
            size="small"
          />
          <Button
            appearance="subtle"
            icon={isSaving ? <Spinner size="tiny" /> : <Checkmark20Regular />}
            onClick={() => void handleSave()}
            disabled={isSaving}
            title="Save"
            size="small"
          />
          <Button
            appearance="subtle"
            icon={<Dismiss20Regular />}
            onClick={handleCancel}
            disabled={isSaving}
            title="Cancel"
            size="small"
          />
        </div>
        {error && <Text className={styles.error}>{error}</Text>}
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div 
        className={styles.nameDisplay}
        onClick={handleStartEdit}
        onKeyDown={(e) => e.key === 'Enter' && handleStartEdit()}
        role={editable ? 'button' : undefined}
        tabIndex={editable ? 0 : undefined}
      >
        <Text weight="semibold">{displayName}</Text>
        {editable && (
          <Edit20Regular 
            className={`${styles.editIcon} edit-icon`} 
            aria-label="Edit name"
          />
        )}
      </div>
      {showDeviceId && deviceEui && deviceEui !== displayName && (
        <Text className={styles.subtext}>({deviceEui})</Text>
      )}
    </div>
  );
}
