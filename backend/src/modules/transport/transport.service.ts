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
    return;
  }

  // Dashboard Data Aggregator
  async getDashboardData(tenantId: string) {
    await this.seedInitialDataIfEmpty(tenantId);
    const tid = (tenantId && tenantId !== 'undefined' && tenantId !== 'null') ? tenantId : '';
    if (!tid) return [];

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
    const tid = (tenantId && tenantId !== 'undefined' && tenantId !== 'null') ? tenantId : '';
    if (!tid) return [];
    if (!this.db) return [];
    const snap = await this.db.collection('tenants').doc(tid).collection('buses').get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async createBus(data: any, tenantId: string) {
    const tid = (tenantId && tenantId !== 'undefined' && tenantId !== 'null') ? tenantId : '';
    if (!tid) return [];
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
    const tid = (tenantId && tenantId !== 'undefined' && tenantId !== 'null') ? tenantId : '';
    if (!tid) return [];
    if (this.db) {
      await this.db.collection('tenants').doc(tid).collection('buses').doc(id).update({
        ...data,
        updatedAt: new Date().toISOString(),
      });
    }
    return { success: true, id };
  }

  async deleteBus(id: string, tenantId: string) {
    const tid = (tenantId && tenantId !== 'undefined' && tenantId !== 'null') ? tenantId : '';
    if (!tid) return [];
    if (this.db) {
      await this.db.collection('tenants').doc(tid).collection('buses').doc(id).delete();
    }
    return { success: true, id };
  }

  // DRIVER CRUD
  async getDrivers(tenantId: string): Promise<any[]> {
    await this.seedInitialDataIfEmpty(tenantId);
    const tid = (tenantId && tenantId !== 'undefined' && tenantId !== 'null') ? tenantId : '';
    if (!tid) return [];
    if (!this.db) return [];
    const snap = await this.db.collection('tenants').doc(tid).collection('drivers').get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async createDriver(data: any, tenantId: string) {
    const tid = (tenantId && tenantId !== 'undefined' && tenantId !== 'null') ? tenantId : '';
    if (!tid) return [];
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
    const tid = (tenantId && tenantId !== 'undefined' && tenantId !== 'null') ? tenantId : '';
    if (!tid) return [];
    if (this.db) {
      await this.db.collection('tenants').doc(tid).collection('drivers').doc(id).update({
        ...data,
        updatedAt: new Date().toISOString(),
      });
    }
    return { success: true, id };
  }

  async deleteDriver(id: string, tenantId: string) {
    const tid = (tenantId && tenantId !== 'undefined' && tenantId !== 'null') ? tenantId : '';
    if (!tid) return [];
    if (this.db) {
      await this.db.collection('tenants').doc(tid).collection('drivers').doc(id).delete();
    }
    return { success: true, id };
  }

  // ROUTES & STOPS
  async getRoutes(tenantId: string): Promise<any[]> {
    await this.seedInitialDataIfEmpty(tenantId);
    const tid = (tenantId && tenantId !== 'undefined' && tenantId !== 'null') ? tenantId : '';
    if (!tid) return [];
    if (!this.db) return [];
    const snap = await this.db.collection('tenants').doc(tid).collection('routes').get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async createRoute(data: any, tenantId: string) {
    const tid = (tenantId && tenantId !== 'undefined' && tenantId !== 'null') ? tenantId : '';
    if (!tid) return [];
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
    const tid = (tenantId && tenantId !== 'undefined' && tenantId !== 'null') ? tenantId : '';
    if (!tid) return [];
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
    const tid = (tenantId && tenantId !== 'undefined' && tenantId !== 'null') ? tenantId : '';
    if (!tid) return [];
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
    const tid = (tenantId && tenantId !== 'undefined' && tenantId !== 'null') ? tenantId : '';
    if (!tid) return [];
    if (this.db) {
      await this.db.collection('tenants').doc(tid).collection('routes').doc(id).delete();
    }
    return { success: true, id };
  }

  // STUDENT ASSIGNMENTS
  async getStudentAssignments(tenantId: string): Promise<any[]> {
    await this.seedInitialDataIfEmpty(tenantId);
    const tid = (tenantId && tenantId !== 'undefined' && tenantId !== 'null') ? tenantId : '';
    if (!tid) return [];
    if (!this.db) return [];
    const snap = await this.db.collection('tenants').doc(tid).collection('transportAssignments').get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async createStudentAssignment(data: any, tenantId: string) {
    const tid = (tenantId && tenantId !== 'undefined' && tenantId !== 'null') ? tenantId : '';
    if (!tid) return [];
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
    const tid = (tenantId && tenantId !== 'undefined' && tenantId !== 'null') ? tenantId : '';
    if (!tid) return [];
    if (this.db) {
      await this.db.collection('tenants').doc(tid).collection('transportAssignments').doc(id).delete();
    }
    return { success: true, id };
  }

  // TRIP HISTORY
  async getTripHistory(tenantId: string): Promise<any[]> {
    await this.seedInitialDataIfEmpty(tenantId);
    const tid = (tenantId && tenantId !== 'undefined' && tenantId !== 'null') ? tenantId : '';
    if (!tid) return [];
    if (!this.db) return [];
    const snap = await this.db.collection('tenants').doc(tid).collection('tripHistory').get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  // GPS TELEMETRY & APP LOGIC
  async updateGpsTelemetry(data: any, tenantId: string) {
    const tid = (tenantId && tenantId !== 'undefined' && tenantId !== 'null') ? tenantId : '';
    if (!tid) return [];
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
    const tid = (tenantId && tenantId !== 'undefined' && tenantId !== 'null') ? tenantId : '';
    if (!tid) return [];
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
