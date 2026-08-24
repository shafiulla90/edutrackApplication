import { Injectable, Inject, Optional } from '@nestjs/common';
import { FirebaseService } from '../../database/firebase.service';
import { randomUUID } from 'crypto';

@Injectable()
export class TransportService {
  constructor(@Optional() private readonly firebaseService?: FirebaseService) {}

  private get db() {
    return this.firebaseService?.getFirestore();
  }

  // Ensure initial seed data exists if Firestore collection is empty
  async seedInitialDataIfEmpty(tenantId: string) {
    if (!this.db) return;
    const tid = tenantId || 'tenant-test-001';
    const tenantRef = this.db.collection('tenants').doc(tid);

    const busesSnap = await tenantRef.collection('buses').get().catch(() => null);
    if (busesSnap && !busesSnap.empty) return; // Already seeded

    console.log('[TransportService] Seeding initial transport fleet data for tenant:', tid);

    // 1. Seed Drivers
    const driver1Id = 'driver-001';
    const driver2Id = 'driver-002';
    const driver3Id = 'driver-003';

    await tenantRef.collection('drivers').doc(driver1Id).set({
      id: driver1Id,
      name: 'Ramesh Kumar',
      phone: '9876543210',
      employeeId: 'DRV-101',
      licenseNumber: 'DL-MH12-202100456',
      licenseExpiry: '2029-12-31',
      address: 'Shivajinagar, Pune',
      emergencyContact: '9876543211',
      status: 'ON_DUTY',
      createdAt: new Date().toISOString(),
    });

    await tenantRef.collection('drivers').doc(driver2Id).set({
      id: driver2Id,
      name: 'Suresh Patil',
      phone: '9822114455',
      employeeId: 'DRV-102',
      licenseNumber: 'DL-MH12-202000890',
      licenseExpiry: '2028-08-15',
      address: 'Kothrud, Pune',
      emergencyContact: '9822114456',
      status: 'ON_DUTY',
      createdAt: new Date().toISOString(),
    });

    await tenantRef.collection('drivers').doc(driver3Id).set({
      id: driver3Id,
      name: 'Mahesh Shinde',
      phone: '9766554433',
      employeeId: 'DRV-103',
      licenseNumber: 'DL-MH12-201900123',
      licenseExpiry: '2027-05-20',
      address: 'Hadapsar, Pune',
      emergencyContact: '9766554434',
      status: 'OFFLINE',
      createdAt: new Date().toISOString(),
    });

    // 2. Seed Routes & Stops
    const route1Id = 'route-001';
    const route2Id = 'route-002';

    await tenantRef.collection('routes').doc(route1Id).set({
      id: route1Id,
      routeName: 'Route 1: Kothrud - Swargate Express',
      startPoint: 'Kothrud Stand',
      endPoint: 'Greenwood Campus',
      description: 'Morning pickup serving Kothrud, Deccan, and Swargate',
      stops: [
        { id: 'stop-101', stopName: 'Kothrud Bus Stand', sequenceOrder: 1, pickupTime: '07:15 AM', dropTime: '02:45 PM', lat: 18.5074, lng: 73.8077 },
        { id: 'stop-102', stopName: 'Deccan Gymkhana', sequenceOrder: 2, pickupTime: '07:30 AM', dropTime: '02:30 PM', lat: 18.5167, lng: 73.8412 },
        { id: 'stop-103', stopName: 'Swargate Square', sequenceOrder: 3, pickupTime: '07:45 AM', dropTime: '02:15 PM', lat: 18.5018, lng: 73.8636 },
        { id: 'stop-104', stopName: 'Greenwood Campus Gate 1', sequenceOrder: 4, pickupTime: '08:00 AM', dropTime: '02:00 PM', lat: 18.5204, lng: 73.8567 },
      ],
      createdAt: new Date().toISOString(),
    });

    await tenantRef.collection('routes').doc(route2Id).set({
      id: route2Id,
      routeName: 'Route 2: Aundh - Baner Highway Express',
      startPoint: 'Aundh DP Road',
      endPoint: 'Greenwood Campus',
      description: 'Morning pickup serving Aundh, Baner, and Pashan',
      stops: [
        { id: 'stop-201', stopName: 'Aundh Parihar Chowk', sequenceOrder: 1, pickupTime: '07:10 AM', dropTime: '02:50 PM', lat: 18.5602, lng: 73.8070 },
        { id: 'stop-202', stopName: 'Baner Balewadi Phata', sequenceOrder: 2, pickupTime: '07:25 AM', dropTime: '02:35 PM', lat: 18.5590, lng: 73.7868 },
        { id: 'stop-203', stopName: 'Pashan Circle', sequenceOrder: 3, pickupTime: '07:40 AM', dropTime: '02:20 PM', lat: 18.5414, lng: 73.7925 },
        { id: 'stop-204', stopName: 'Greenwood Campus Gate 2', sequenceOrder: 4, pickupTime: '08:00 AM', dropTime: '02:00 PM', lat: 18.5204, lng: 73.8567 },
      ],
      createdAt: new Date().toISOString(),
    });

    // 3. Seed Buses
    const bus1Id = 'bus-001';
    const bus2Id = 'bus-002';
    const bus3Id = 'bus-003';

    await tenantRef.collection('buses').doc(bus1Id).set({
      id: bus1Id,
      busNumber: 'Bus 01',
      registrationNo: 'MH-12-AB-1234',
      vehicleModel: 'Tata Starbus 40-Seater',
      capacity: 40,
      driverId: driver1Id,
      driverName: 'Ramesh Kumar',
      driverPhone: '9876543210',
      routeId: route1Id,
      routeName: 'Route 1: Kothrud - Swargate Express',
      status: 'RUNNING',
      dutyStatus: 'RUNNING',
      currentLat: 18.5167,
      currentLng: 73.8412,
      currentSpeed: 32,
      currentHeading: 85,
      lastGpsUpdate: new Date().toISOString(),
      assignedStudentsCount: 28,
      createdAt: new Date().toISOString(),
    });

    await tenantRef.collection('buses').doc(bus2Id).set({
      id: bus2Id,
      busNumber: 'Bus 02',
      registrationNo: 'MH-12-CD-5678',
      vehicleModel: 'Ashok Leyland Sunshine 35',
      capacity: 35,
      driverId: driver2Id,
      driverName: 'Suresh Patil',
      driverPhone: '9822114455',
      routeId: route2Id,
      routeName: 'Route 2: Aundh - Baner Highway Express',
      status: 'ACTIVE',
      dutyStatus: 'RUNNING',
      currentLat: 18.5590,
      currentLng: 73.7868,
      currentSpeed: 28,
      currentHeading: 120,
      lastGpsUpdate: new Date().toISOString(),
      assignedStudentsCount: 22,
      createdAt: new Date().toISOString(),
    });

    await tenantRef.collection('buses').doc(bus3Id).set({
      id: bus3Id,
      busNumber: 'Bus 03',
      registrationNo: 'MH-12-EF-9012',
      vehicleModel: 'Eicher Skyline Pro',
      capacity: 45,
      driverId: driver3Id,
      driverName: 'Mahesh Shinde',
      driverPhone: '9766554433',
      routeId: '',
      routeName: 'Unassigned',
      status: 'MAINTENANCE',
      dutyStatus: 'OFFLINE',
      currentLat: 18.5204,
      currentLng: 73.8567,
      currentSpeed: 0,
      currentHeading: 0,
      lastGpsUpdate: new Date().toISOString(),
      assignedStudentsCount: 0,
      createdAt: new Date().toISOString(),
    });

    // 4. Seed Student Assignments
    const assign1Id = 'assign-001';
    await tenantRef.collection('transportAssignments').doc(assign1Id).set({
      id: assign1Id,
      studentId: '2f07f05a-e5b7-445c-b08e-a5b7d469907c',
      studentName: 'Mohamd huzaifa',
      className: 'Class-1',
      sectionName: 'Section-A',
      busId: bus1Id,
      busNumber: 'Bus 01',
      routeId: route1Id,
      routeName: 'Route 1: Kothrud - Swargate Express',
      stopId: 'stop-102',
      stopName: 'Deccan Gymkhana',
      pickupTime: '07:30 AM',
      dropTime: '02:30 PM',
      parentPhone: '9642402639',
      createdAt: new Date().toISOString(),
    });

    // 5. Seed Trip History
    const trip1Id = 'trip-001';
    await tenantRef.collection('tripHistory').doc(trip1Id).set({
      id: trip1Id,
      busId: bus1Id,
      busNumber: 'Bus 01',
      driverName: 'Ramesh Kumar',
      routeName: 'Route 1: Kothrud - Swargate Express',
      tripType: 'MORNING_PICKUP',
      startTime: new Date(Date.now() - 3600000).toISOString(),
      endTime: new Date().toISOString(),
      status: 'COMPLETED',
      totalDistanceKm: 14.2,
      maxSpeedKmph: 45,
      createdAt: new Date().toISOString(),
    });
  }

  // Dashboard Data Aggregator
  async getDashboardData(tenantId: string) {
    await this.seedInitialDataIfEmpty(tenantId);
    const tid = tenantId || 'tenant-test-001';

    let buses: any[] = [];
    let drivers: any[] = [];
    let routes: any[] = [];
    let studentAssignments: any[] = [];

    if (this.db) {
      const tenantRef = this.db.collection('tenants').doc(tid);
      const [busesSnap, driversSnap, routesSnap, assignSnap] = await Promise.all([
        tenantRef.collection('buses').get().catch(() => ({ docs: [] } as any)),
        tenantRef.collection('drivers').get().catch(() => ({ docs: [] } as any)),
        tenantRef.collection('routes').get().catch(() => ({ docs: [] } as any)),
        tenantRef.collection('transportAssignments').get().catch(() => ({ docs: [] } as any)),
      ]);

      buses = busesSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      drivers = driversSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      routes = routesSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      studentAssignments = assignSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    }

    // Simulate slight live GPS movement for running buses for realistic live tracking demo!
    buses = buses.map(bus => {
      if (bus.status === 'RUNNING' || bus.dutyStatus === 'RUNNING') {
        const latJitter = (Math.random() - 0.5) * 0.0015;
        const lngJitter = (Math.random() - 0.5) * 0.0015;
        const speed = Math.floor(25 + Math.random() * 15);
        return {
          ...bus,
          currentLat: Number((bus.currentLat + latJitter).toFixed(6)),
          currentLng: Number((bus.currentLng + lngJitter).toFixed(6)),
          currentSpeed: speed,
          lastGpsUpdate: new Date().toISOString(),
          isOnline: true,
        };
      }
      return bus;
    });

    const totalBuses = buses.length;
    const activeBuses = buses.filter(b => b.status === 'ACTIVE' || b.status === 'RUNNING').length;
    const busesRunning = buses.filter(b => b.status === 'RUNNING' || b.dutyStatus === 'RUNNING').length;
    const driversOnDuty = drivers.filter(d => d.status === 'ON_DUTY').length;
    const offlineDrivers = drivers.filter(d => d.status !== 'ON_DUTY').length;
    const gpsStale = 0;
    const studentsAssigned = studentAssignments.length;
    const routesRunning = routes.length;

    return {
      stats: {
        totalBuses,
        activeBuses,
        busesRunning,
        driversOnDuty,
        offlineDrivers,
        gpsStale,
        studentsAssigned,
        routesRunning,
      },
      buses,
      drivers,
      routes,
    };
  }

  // BUS CRUD
  async getBuses(tenantId: string): Promise<any[]> {
    await this.seedInitialDataIfEmpty(tenantId);
    const tid = tenantId || 'tenant-test-001';
    if (!this.db) return [];
    const snap = await this.db.collection('tenants').doc(tid).collection('buses').get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async createBus(data: any, tenantId: string) {
    const tid = tenantId || 'tenant-test-001';
    const id = 'bus-' + randomUUID().slice(0, 8);
    const newBus = {
      id,
      busNumber: data.busNumber || 'Bus ' + id,
      registrationNo: data.registrationNo || '',
      vehicleModel: data.vehicleModel || 'Standard School Bus',
      capacity: Number(data.capacity) || 40,
      driverId: data.driverId || '',
      routeId: data.routeId || '',
      status: data.status || 'ACTIVE',
      dutyStatus: 'NOT_STARTED',
      currentLat: 18.5204,
      currentLng: 73.8567,
      currentSpeed: 0,
      currentHeading: 0,
      lastGpsUpdate: new Date().toISOString(),
      assignedStudentsCount: 0,
      createdAt: new Date().toISOString(),
    };

    if (this.db) {
      await this.db.collection('tenants').doc(tid).collection('buses').doc(id).set(newBus);
    }
    return { success: true, bus: newBus };
  }

  async updateBus(id: string, data: any, tenantId: string) {
    const tid = tenantId || 'tenant-test-001';
    if (this.db) {
      await this.db.collection('tenants').doc(tid).collection('buses').doc(id).update({
        ...data,
        updatedAt: new Date().toISOString(),
      });
    }
    return { success: true, id };
  }

  async deleteBus(id: string, tenantId: string) {
    const tid = tenantId || 'tenant-test-001';
    if (this.db) {
      await this.db.collection('tenants').doc(tid).collection('buses').doc(id).delete();
    }
    return { success: true, id };
  }

  // DRIVER CRUD
  async getDrivers(tenantId: string): Promise<any[]> {
    await this.seedInitialDataIfEmpty(tenantId);
    const tid = tenantId || 'tenant-test-001';
    if (!this.db) return [];
    const snap = await this.db.collection('tenants').doc(tid).collection('drivers').get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async createDriver(data: any, tenantId: string) {
    const tid = tenantId || 'tenant-test-001';
    const id = 'driver-' + randomUUID().slice(0, 8);
    const newDriver = {
      id,
      name: data.name,
      phone: data.phone,
      employeeId: data.employeeId || 'DRV-' + Math.floor(100 + Math.random() * 900),
      licenseNumber: data.licenseNumber || '',
      licenseExpiry: data.licenseExpiry || '',
      aadhaarNo: data.aadhaarNo || '',
      address: data.address || '',
      emergencyContact: data.emergencyContact || '',
      status: 'ON_DUTY',
      createdAt: new Date().toISOString(),
    };

    if (this.db) {
      await this.db.collection('tenants').doc(tid).collection('drivers').doc(id).set(newDriver);
    }
    return { success: true, driver: newDriver };
  }

  async updateDriver(id: string, data: any, tenantId: string) {
    const tid = tenantId || 'tenant-test-001';
    if (this.db) {
      await this.db.collection('tenants').doc(tid).collection('drivers').doc(id).update({
        ...data,
        updatedAt: new Date().toISOString(),
      });
    }
    return { success: true, id };
  }

  async deleteDriver(id: string, tenantId: string) {
    const tid = tenantId || 'tenant-test-001';
    if (this.db) {
      await this.db.collection('tenants').doc(tid).collection('drivers').doc(id).delete();
    }
    return { success: true, id };
  }

  // ROUTES & STOPS
  async getRoutes(tenantId: string): Promise<any[]> {
    await this.seedInitialDataIfEmpty(tenantId);
    const tid = tenantId || 'tenant-test-001';
    if (!this.db) return [];
    const snap = await this.db.collection('tenants').doc(tid).collection('routes').get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async createRoute(data: any, tenantId: string) {
    const tid = tenantId || 'tenant-test-001';
    const id = 'route-' + randomUUID().slice(0, 8);
    const newRoute = {
      id,
      routeName: data.routeName,
      startPoint: data.startPoint,
      endPoint: data.endPoint,
      description: data.description || '',
      stops: data.stops || [],
      createdAt: new Date().toISOString(),
    };

    if (this.db) {
      await this.db.collection('tenants').doc(tid).collection('routes').doc(id).set(newRoute);
    }
    return { success: true, route: newRoute };
  }

  async addStopToRoute(routeId: string, stopData: any, tenantId: string) {
    const tid = tenantId || 'tenant-test-001';
    if (!this.db) return { success: false };
    const routeRef = this.db.collection('tenants').doc(tid).collection('routes').doc(routeId);
    const routeDoc = await routeRef.get();
    if (!routeDoc.exists) return { success: false, message: 'Route not found' };

    const route = routeDoc.data() || {};
    const stops = route.stops || [];
    const newStop = {
      id: 'stop-' + randomUUID().slice(0, 8),
      stopName: stopData.stopName,
      sequenceOrder: Number(stopData.sequenceOrder) || stops.length + 1,
      pickupTime: stopData.pickupTime || '07:30 AM',
      dropTime: stopData.dropTime || '02:30 PM',
      lat: Number(stopData.lat) || 18.5204,
      lng: Number(stopData.lng) || 73.8567,
    };
    stops.push(newStop);
    await routeRef.update({ stops, updatedAt: new Date().toISOString() });

    return { success: true, stop: newStop };
  }

  async deleteStopFromRoute(routeId: string, stopId: string, tenantId: string) {
    const tid = tenantId || 'tenant-test-001';
    if (!this.db) return { success: false };
    const routeRef = this.db.collection('tenants').doc(tid).collection('routes').doc(routeId);
    const routeDoc = await routeRef.get();
    if (!routeDoc.exists) return { success: false, message: 'Route not found' };

    const route = routeDoc.data() || {};
    const stops = (route.stops || []).filter((s: any) => s.id !== stopId);
    await routeRef.update({ stops, updatedAt: new Date().toISOString() });

    return { success: true, stopId };
  }

  async deleteRoute(id: string, tenantId: string) {
    const tid = tenantId || 'tenant-test-001';
    if (this.db) {
      await this.db.collection('tenants').doc(tid).collection('routes').doc(id).delete();
    }
    return { success: true, id };
  }

  // STUDENT ASSIGNMENTS
  async getStudentAssignments(tenantId: string): Promise<any[]> {
    await this.seedInitialDataIfEmpty(tenantId);
    const tid = tenantId || 'tenant-test-001';
    if (!this.db) return [];
    const snap = await this.db.collection('tenants').doc(tid).collection('transportAssignments').get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async createStudentAssignment(data: any, tenantId: string) {
    const tid = tenantId || 'tenant-test-001';
    const id = 'assign-' + randomUUID().slice(0, 8);
    const newAssignment = {
      id,
      studentId: data.studentId,
      studentName: data.studentName || 'Student',
      className: data.className || '',
      sectionName: data.sectionName || '',
      busId: data.busId,
      busNumber: data.busNumber || '',
      routeId: data.routeId || '',
      routeName: data.routeName || '',
      stopId: data.stopId || '',
      stopName: data.stopName || '',
      pickupTime: data.pickupTime || '07:30 AM',
      dropTime: data.dropTime || '02:30 PM',
      parentPhone: data.parentPhone || '',
      createdAt: new Date().toISOString(),
    };

    if (this.db) {
      await this.db.collection('tenants').doc(tid).collection('transportAssignments').doc(id).set(newAssignment);
    }
    return { success: true, assignment: newAssignment };
  }

  async deleteStudentAssignment(id: string, tenantId: string) {
    const tid = tenantId || 'tenant-test-001';
    if (this.db) {
      await this.db.collection('tenants').doc(tid).collection('transportAssignments').doc(id).delete();
    }
    return { success: true, id };
  }

  // TRIP HISTORY
  async getTripHistory(tenantId: string): Promise<any[]> {
    await this.seedInitialDataIfEmpty(tenantId);
    const tid = tenantId || 'tenant-test-001';
    if (!this.db) return [];
    const snap = await this.db.collection('tenants').doc(tid).collection('tripHistory').get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  // GPS TELEMETRY & APP LOGIC
  async updateGpsTelemetry(data: any, tenantId: string) {
    const tid = tenantId || 'tenant-test-001';
    const busId = data.busId || 'bus-001';
    if (this.db) {
      await this.db.collection('tenants').doc(tid).collection('buses').doc(busId).update({
        currentLat: Number(data.lat),
        currentLng: Number(data.lng),
        currentSpeed: Number(data.speed) || 0,
        currentHeading: Number(data.heading) || 0,
        dutyStatus: data.dutyStatus || 'RUNNING',
        lastGpsUpdate: new Date().toISOString(),
      });
    }
    return { success: true, busId };
  }

  async getDriverAssignedBus(tenantId: string) {
    await this.seedInitialDataIfEmpty(tenantId);
    const buses: any[] = await this.getBuses(tenantId);
    const assignedBus: any = buses[0] || null;
    const routes: any[] = await this.getRoutes(tenantId);
    const assignedRoute: any = routes.find(r => r.id === assignedBus?.routeId) || routes[0] || null;

    return {
      success: true,
      bus: assignedBus,
      route: assignedRoute,
    };
  }

  async handleDriverTripAction(data: any, tenantId: string) {
    const tid = tenantId || 'tenant-test-001';
    const busId = data.busId || 'bus-001';
    const action = data.action; // START_TRIP | STOP_TRIP | SOS

    if (this.db) {
      if (action === 'START_TRIP') {
        await this.db.collection('tenants').doc(tid).collection('buses').doc(busId).update({
          status: 'RUNNING',
          dutyStatus: 'RUNNING',
          lastGpsUpdate: new Date().toISOString(),
        });
      } else if (action === 'STOP_TRIP') {
        await this.db.collection('tenants').doc(tid).collection('buses').doc(busId).update({
          status: 'ACTIVE',
          dutyStatus: 'COMPLETED',
          lastGpsUpdate: new Date().toISOString(),
        });
      }
    }

    return { success: true, action, busId };
  }

  async getParentLiveTracking(studentId: string, tenantId: string) {
    await this.seedInitialDataIfEmpty(tenantId);
    const assignments: any[] = await this.getStudentAssignments(tenantId);
    const match: any = assignments.find(a => a.studentId === studentId) || assignments[0];

    if (!match) {
      return {
        hasBusAssigned: false,
        message: 'No bus allocated for this student',
      };
    }

    const buses: any[] = await this.getBuses(tenantId);
    const bus: any = buses.find(b => b.id === match.busId) || buses[0];

    const routes: any[] = await this.getRoutes(tenantId);
    const route: any = routes.find(r => r.id === match.routeId) || routes[0];

    return {
      hasBusAssigned: true,
      studentName: match.studentName,
      bus: {
        ...bus,
        currentLat: bus.currentLat || 18.5167,
        currentLng: bus.currentLng || 73.8412,
        currentSpeed: bus.currentSpeed || 30,
        dutyStatus: bus.dutyStatus || 'RUNNING',
        isOnline: bus.dutyStatus === 'RUNNING',
      },
      route,
      assignedStop: {
        stopId: match.stopId,
        stopName: match.stopName || 'Deccan Gymkhana',
        pickupTime: match.pickupTime || '07:30 AM',
        dropTime: match.dropTime || '02:30 PM',
      },
      etaMinutes: 12,
    };
  }
}
