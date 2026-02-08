import React, { useState, useCallback } from 'react';
import {
  View,
  Image,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, runOnJS } from 'react-native-reanimated';
import Svg, { Path, Circle } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';
import { pointInPolygon } from '../lib/blueprint-geometry';
import type { BlueprintRoom, BlueprintPin, Task } from '../types/database';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MIN_SCALE = 0.5;
const MAX_SCALE = 4;
const PIN_HIT_RADIUS = 24;

interface BlueprintViewProps {
  imageUrl: string | null;
  rooms: BlueprintRoom[];
  pins: BlueprintPin[];
  tasks: Task[];
  loading?: boolean;
  onPinPress?: (taskId: string) => void;
  onRoomPress?: (roomName: string) => void;
}

function roomPointsToPath(points: { x: number; y: number }[], scale: number): string {
  if (points.length < 2) return '';
  const scaled = points.map((p) => `${p.x * scale},${p.y * scale}`);
  return `M ${scaled[0]} L ${scaled.slice(1).join(' L ')} Z`;
}

export default function BlueprintView({
  imageUrl,
  rooms,
  pins,
  tasks,
  loading,
  onPinPress,
  onRoomPress,
}: BlueprintViewProps) {
  const { colors, priorities } = useTheme();
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [imageError, setImageError] = useState(false);
  const [selectedPinTaskId, setSelectedPinTaskId] = useState<string | null>(null);

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const offset = useSharedValue({ x: 0, y: 0 });
  const startOffset = useSharedValue({ x: 0, y: 0 });

  const onImageLoad = useCallback(() => {
    if (!imageUrl) return;
    Image.getSize(
      imageUrl,
      (width, height) => setImageSize({ width, height }) as void,
      () => setImageError(true)
    );
  }, [imageUrl]);

  const handleBlueprintTap = useCallback(
    (x: number, y: number) => {
      if (!imageSize) return;
      const baseScale = Math.min(
        SCREEN_WIDTH / imageSize.width,
        SCREEN_HEIGHT / imageSize.height,
        2
      );
      const displayWidth = imageSize.width * baseScale;
      const displayHeight = imageSize.height * baseScale;
      // Hit test pins first (display coords)
      for (const pin of pins) {
        const px = pin.x * baseScale;
        const py = pin.y * baseScale;
        if (Math.hypot(x - px, y - py) <= PIN_HIT_RADIUS) {
          setSelectedPinTaskId(pin.taskId);
          return;
        }
      }
      // Convert to image coords for room hit test
      const imageX = (x * imageSize.width) / displayWidth;
      const imageY = (y * imageSize.height) / displayHeight;
      for (const room of rooms) {
        if (pointInPolygon({ x: imageX, y: imageY }, room.points)) {
          onRoomPress?.(room.name);
          setSelectedPinTaskId(null);
          return;
        }
      }
      setSelectedPinTaskId(null);
    },
    [imageSize, pins, rooms, onRoomPress]
  );

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      const next = savedScale.value * e.scale;
      scale.value = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const pan = Gesture.Pan()
    .onStart(() => {
      startOffset.value = { x: offset.value.x, y: offset.value.y };
    })
    .onUpdate((e) => {
      offset.value = {
        x: startOffset.value.x + e.translationX,
        y: startOffset.value.y + e.translationY,
      };
    })
    .onEnd(() => {
      startOffset.value = { x: offset.value.x, y: offset.value.y };
    });

  const tap = Gesture.Tap()
    .onEnd((e) => {
      runOnJS(handleBlueprintTap)(e.x, e.y);
    });

  const composed = Gesture.Race(Gesture.Simultaneous(pinch, pan), tap);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: offset.value.x },
      { translateY: offset.value.y },
      { scale: scale.value },
    ],
  }));

  if (loading) {
    return (
      <View style={[styles.placeholder, { backgroundColor: colors.surface }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!imageUrl || imageError) {
    return (
      <View style={[styles.placeholder, { backgroundColor: colors.surface }]}>
        <Text style={[styles.placeholderText, { color: colors.textMuted }]}>
          The blueprint view goes here
        </Text>
        <Text style={[styles.placeholderSubtext, { color: colors.textMuted }]}>
          Add a blueprint in project settings
        </Text>
      </View>
    );
  }

  if (!imageSize) {
    return (
      <View style={[styles.placeholder, { backgroundColor: colors.surface }]}>
        <Image
          source={{ uri: imageUrl }}
          style={styles.hiddenImage}
          onLoad={onImageLoad}
          onError={() => setImageError(true)}
        />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const baseScale = Math.min(
    SCREEN_WIDTH / imageSize.width,
    SCREEN_HEIGHT / imageSize.height,
    2
  );
  const displayWidth = imageSize.width * baseScale;
  const displayHeight = imageSize.height * baseScale;

  const taskById = (id: string) => tasks.find((t) => t.id === id);
  const selectedPin = selectedPinTaskId ? pins.find((p) => p.taskId === selectedPinTaskId) : null;
  const selectedTask = selectedPinTaskId ? taskById(selectedPinTaskId) : null;

  return (
    <View style={styles.wrapper} collapsable={false}>
      <GestureDetector gesture={composed}>
        <Animated.View
          style={[
            styles.contentWrap,
            { width: displayWidth, height: displayHeight },
            animatedStyle,
          ]}
        >
          <View style={{ width: displayWidth, height: displayHeight }}>
            <Image
              source={{ uri: imageUrl }}
              style={{ width: displayWidth, height: displayHeight }}
              resizeMode="contain"
              onLoad={onImageLoad}
            />
            <View style={[StyleSheet.absoluteFill, { width: displayWidth, height: displayHeight }]} pointerEvents="box-none">
              <Svg width={displayWidth} height={displayHeight} style={StyleSheet.absoluteFill} pointerEvents="none">
                {rooms.map((room) => (
                  <Path
                    key={room.id}
                    d={roomPointsToPath(room.points, baseScale)}
                    fill="rgba(100, 149, 237, 0.15)"
                    stroke={colors.primary}
                    strokeWidth={2}
                  />
                ))}
              </Svg>
              {pins.map((pin) => {
                const task = taskById(pin.taskId);
                const isCompleted = task?.status === 'completed';
                return (
                  <TouchableOpacity
                    key={pin.id}
                    activeOpacity={0.8}
                    onPress={() => setSelectedPinTaskId(pin.taskId)}
                    style={[
                      styles.pinTouch,
                      {
                        left: pin.x * baseScale - 16,
                        top: pin.y * baseScale - 32,
                        width: 32,
                        height: 32,
                      },
                    ]}
                  >
                    <Svg width={32} height={32} style={styles.pinSvg}>
                      <Circle
                        cx={16}
                        cy={16}
                        r={12}
                        fill={isCompleted ? colors.success : colors.primary}
                        stroke="#fff"
                        strokeWidth={2}
                      />
                      <Circle cx={16} cy={16} r={4} fill="#fff" />
                    </Svg>
                  </TouchableOpacity>
                );
              })}
              {selectedPin && selectedTask && (
                <Pressable
                  style={[
                    styles.pinPreview,
                    {
                      left: selectedPin.x * baseScale - 72,
                      top: selectedPin.y * baseScale - 88,
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() => {
                    onPinPress?.(selectedPinTaskId!);
                    setSelectedPinTaskId(null);
                  }}
                >
                  <Text style={[styles.pinPreviewTitle, { color: colors.text }]} numberOfLines={2}>
                    {selectedTask.title}
                  </Text>
                  {selectedTask.location ? (
                    <Text style={[styles.pinPreviewLocation, { color: colors.textMuted }]} numberOfLines={1}>
                      {selectedTask.location}
                    </Text>
                  ) : null}
                  <View style={[styles.pinPreviewBadge, { backgroundColor: (priorities[selectedTask.priority as keyof typeof priorities] || priorities.medium).bg }]}>
                    <Text style={[styles.pinPreviewBadgeText, { color: (priorities[selectedTask.priority as keyof typeof priorities] || priorities.medium).color }]}>
                      {(priorities[selectedTask.priority as keyof typeof priorities] || priorities.medium).label}
                    </Text>
                  </View>
                  <Text style={[styles.pinPreviewTap, { color: colors.primary }]}>Tap to open</Text>
                </Pressable>
              )}
            </View>
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, overflow: 'hidden' },
  contentWrap: { alignSelf: 'flex-start' },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  placeholderText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  placeholderSubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  hiddenImage: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  pinTouch: { position: 'absolute', justifyContent: 'center', alignItems: 'center' },
  pinSvg: {},
  pinPreview: {
    position: 'absolute',
    width: 144,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  pinPreviewTitle: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  pinPreviewLocation: { fontSize: 12, marginBottom: 4 },
  pinPreviewBadge: { alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginBottom: 4 },
  pinPreviewBadgeText: { fontSize: 11, fontWeight: '700' },
  pinPreviewTap: { fontSize: 11, fontWeight: '600' },
});
