import {
  useMutation,
  useQuery
} from '@tanstack/react-query';
import type {
  MutationFunction,
  QueryFunction,
  QueryKey,
  UseMutationOptions,
  UseMutationResult,
  UseQueryOptions,
  UseQueryResult
} from '@tanstack/react-query';

import type {
  AdminDashboard,
  DemandForecastItem,
  GetDemandForecastParams,
  GetSearchSuggestionsParams,
  GetTopMedicinesParams,
  HealthStatus,
  InventoryItem,
  InventoryUpdate,
  ListMedicinesParams,
  ListNotificationsParams,
  ListOrdersParams,
  ListPharmaciesParams,
  ListReservationsParams,
  Medicine,
  MedicineAvailability,
  MedicineList,
  MedicineSearchResult,
  Notification,
  Order,
  OrderInput,
  OrderTracking,
  PatientDashboard,
  Pharmacy,
  PharmacyDashboard,
  Prescription,
  PrescriptionInput,
  Reservation,
  ReservationInput,
  ReservationUpdate,
  SearchMedicinesParams,
  SearchSuggestion,
  TopMedicine,
  UserProfile,
  UserProfileUpdate
} from './api.schemas';

import { customFetch } from '../custom-fetch';
import type { ErrorType , BodyType } from '../custom-fetch';

type AwaitedInput<T> = PromiseLike<T> | T;

      type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;


type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];



const withQueryKey = <T extends object, K>(query: T, queryKey: K): T & { queryKey: K } => {
  const result = { queryKey } as T & { queryKey: K };
  for (const key of Object.keys(query)) {
    if (key === 'queryKey') continue;
    Object.defineProperty(result, key, {
      enumerable: true,
      configurable: true,
      get: () => (query as Record<string, unknown>)[key],
    });
  }
  return result;
};

export const getHealthCheckUrl = () => {




  return `/api/healthz`
}

export const healthCheck = async ( options?: RequestInit): Promise<HealthStatus> => {

  return customFetch<HealthStatus>(getHealthCheckUrl(),
  {
    ...options,
    method: 'GET'


  }
);}





export const getHealthCheckQueryKey = () => {
    return [
    `/api/healthz`
    ] as const;
    }


export const getHealthCheckQueryOptions = <TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>( options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getHealthCheckQueryKey();



    const queryFn: QueryFunction<Awaited<ReturnType<typeof healthCheck>>> = ({ signal }) => healthCheck({ signal, ...requestOptions });





   return  { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData> & { queryKey: QueryKey }
}

export type HealthCheckQueryResult = NonNullable<Awaited<ReturnType<typeof healthCheck>>>
export type HealthCheckQueryError = ErrorType<unknown>



export function useHealthCheck<TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(
  options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getHealthCheckQueryOptions(options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







export const getListMedicinesUrl = (params?: ListMedicinesParams,) => {
  const normalizedParams = new URLSearchParams();

  Object.entries(params || {}).forEach(([key, value]) => {

    if (value !== undefined) {
      normalizedParams.append(key, value === null ? 'null' : String(value))
    }
  });

  const stringifiedParams = normalizedParams.toString();

  return stringifiedParams.length > 0 ? `/api/medicines?${stringifiedParams}` : `/api/medicines`
}

export const listMedicines = async (params?: ListMedicinesParams, options?: RequestInit): Promise<MedicineList> => {

  return customFetch<MedicineList>(getListMedicinesUrl(params),
  {
    ...options,
    method: 'GET'


  }
);}





export const getListMedicinesQueryKey = (params?: ListMedicinesParams,) => {
    return [
    `/api/medicines`, ...(params ? [params] : [])
    ] as const;
    }


export const getListMedicinesQueryOptions = <TData = Awaited<ReturnType<typeof listMedicines>>, TError = ErrorType<unknown>>(params?: ListMedicinesParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof listMedicines>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getListMedicinesQueryKey(params);



    const queryFn: QueryFunction<Awaited<ReturnType<typeof listMedicines>>> = ({ signal }) => listMedicines(params, { signal, ...requestOptions });





   return  { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof listMedicines>>, TError, TData> & { queryKey: QueryKey }
}

export type ListMedicinesQueryResult = NonNullable<Awaited<ReturnType<typeof listMedicines>>>
export type ListMedicinesQueryError = ErrorType<unknown>



export function useListMedicines<TData = Awaited<ReturnType<typeof listMedicines>>, TError = ErrorType<unknown>>(
 params?: ListMedicinesParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof listMedicines>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getListMedicinesQueryOptions(params,options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







export const getGetMedicineUrl = (id: number,) => {




  return `/api/medicines/${id}`
}

export const getMedicine = async (id: number, options?: RequestInit): Promise<Medicine> => {

  return customFetch<Medicine>(getGetMedicineUrl(id),
  {
    ...options,
    method: 'GET'


  }
);}





export const getGetMedicineQueryKey = (id: number,) => {
    return [
    `/api/medicines/${id}`
    ] as const;
    }


export const getGetMedicineQueryOptions = <TData = Awaited<ReturnType<typeof getMedicine>>, TError = ErrorType<void>>(id: number, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getMedicine>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getGetMedicineQueryKey(id);



    const queryFn: QueryFunction<Awaited<ReturnType<typeof getMedicine>>> = ({ signal }) => getMedicine(id, { signal, ...requestOptions });





   return  { queryKey, queryFn, enabled: id !== null && id !== undefined, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getMedicine>>, TError, TData> & { queryKey: QueryKey }
}

export type GetMedicineQueryResult = NonNullable<Awaited<ReturnType<typeof getMedicine>>>
export type GetMedicineQueryError = ErrorType<void>



export function useGetMedicine<TData = Awaited<ReturnType<typeof getMedicine>>, TError = ErrorType<void>>(
 id: number, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getMedicine>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getGetMedicineQueryOptions(id,options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







export const getGetMedicineAvailabilityUrl = (id: number,) => {




  return `/api/medicines/${id}/availability`
}

export const getMedicineAvailability = async (id: number, options?: RequestInit): Promise<MedicineAvailability> => {

  return customFetch<MedicineAvailability>(getGetMedicineAvailabilityUrl(id),
  {
    ...options,
    method: 'GET'


  }
);}





export const getGetMedicineAvailabilityQueryKey = (id: number,) => {
    return [
    `/api/medicines/${id}/availability`
    ] as const;
    }


export const getGetMedicineAvailabilityQueryOptions = <TData = Awaited<ReturnType<typeof getMedicineAvailability>>, TError = ErrorType<unknown>>(id: number, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getMedicineAvailability>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getGetMedicineAvailabilityQueryKey(id);



    const queryFn: QueryFunction<Awaited<ReturnType<typeof getMedicineAvailability>>> = ({ signal }) => getMedicineAvailability(id, { signal, ...requestOptions });





   return  { queryKey, queryFn, enabled: id !== null && id !== undefined, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getMedicineAvailability>>, TError, TData> & { queryKey: QueryKey }
}

export type GetMedicineAvailabilityQueryResult = NonNullable<Awaited<ReturnType<typeof getMedicineAvailability>>>
export type GetMedicineAvailabilityQueryError = ErrorType<unknown>



export function useGetMedicineAvailability<TData = Awaited<ReturnType<typeof getMedicineAvailability>>, TError = ErrorType<unknown>>(
 id: number, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getMedicineAvailability>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getGetMedicineAvailabilityQueryOptions(id,options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







export const getListPharmaciesUrl = (params?: ListPharmaciesParams,) => {
  const normalizedParams = new URLSearchParams();

  Object.entries(params || {}).forEach(([key, value]) => {

    if (value !== undefined) {
      normalizedParams.append(key, value === null ? 'null' : String(value))
    }
  });

  const stringifiedParams = normalizedParams.toString();

  return stringifiedParams.length > 0 ? `/api/pharmacies?${stringifiedParams}` : `/api/pharmacies`
}

export const listPharmacies = async (params?: ListPharmaciesParams, options?: RequestInit): Promise<Pharmacy[]> => {

  return customFetch<Pharmacy[]>(getListPharmaciesUrl(params),
  {
    ...options,
    method: 'GET'


  }
);}





export const getListPharmaciesQueryKey = (params?: ListPharmaciesParams,) => {
    return [
    `/api/pharmacies`, ...(params ? [params] : [])
    ] as const;
    }


export const getListPharmaciesQueryOptions = <TData = Awaited<ReturnType<typeof listPharmacies>>, TError = ErrorType<unknown>>(params?: ListPharmaciesParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof listPharmacies>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getListPharmaciesQueryKey(params);



    const queryFn: QueryFunction<Awaited<ReturnType<typeof listPharmacies>>> = ({ signal }) => listPharmacies(params, { signal, ...requestOptions });





   return  { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof listPharmacies>>, TError, TData> & { queryKey: QueryKey }
}

export type ListPharmaciesQueryResult = NonNullable<Awaited<ReturnType<typeof listPharmacies>>>
export type ListPharmaciesQueryError = ErrorType<unknown>



export function useListPharmacies<TData = Awaited<ReturnType<typeof listPharmacies>>, TError = ErrorType<unknown>>(
 params?: ListPharmaciesParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof listPharmacies>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getListPharmaciesQueryOptions(params,options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







export const getGetPharmacyUrl = (id: number,) => {




  return `/api/pharmacies/${id}`
}

export const getPharmacy = async (id: number, options?: RequestInit): Promise<Pharmacy> => {

  return customFetch<Pharmacy>(getGetPharmacyUrl(id),
  {
    ...options,
    method: 'GET'


  }
);}





export const getGetPharmacyQueryKey = (id: number,) => {
    return [
    `/api/pharmacies/${id}`
    ] as const;
    }


export const getGetPharmacyQueryOptions = <TData = Awaited<ReturnType<typeof getPharmacy>>, TError = ErrorType<unknown>>(id: number, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getPharmacy>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getGetPharmacyQueryKey(id);



    const queryFn: QueryFunction<Awaited<ReturnType<typeof getPharmacy>>> = ({ signal }) => getPharmacy(id, { signal, ...requestOptions });





   return  { queryKey, queryFn, enabled: id !== null && id !== undefined, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getPharmacy>>, TError, TData> & { queryKey: QueryKey }
}

export type GetPharmacyQueryResult = NonNullable<Awaited<ReturnType<typeof getPharmacy>>>
export type GetPharmacyQueryError = ErrorType<unknown>



export function useGetPharmacy<TData = Awaited<ReturnType<typeof getPharmacy>>, TError = ErrorType<unknown>>(
 id: number, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getPharmacy>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getGetPharmacyQueryOptions(id,options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







export const getGetPharmacyInventoryUrl = (id: number,) => {




  return `/api/pharmacies/${id}/inventory`
}

export const getPharmacyInventory = async (id: number, options?: RequestInit): Promise<InventoryItem[]> => {

  return customFetch<InventoryItem[]>(getGetPharmacyInventoryUrl(id),
  {
    ...options,
    method: 'GET'


  }
);}





export const getGetPharmacyInventoryQueryKey = (id: number,) => {
    return [
    `/api/pharmacies/${id}/inventory`
    ] as const;
    }


export const getGetPharmacyInventoryQueryOptions = <TData = Awaited<ReturnType<typeof getPharmacyInventory>>, TError = ErrorType<unknown>>(id: number, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getPharmacyInventory>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getGetPharmacyInventoryQueryKey(id);



    const queryFn: QueryFunction<Awaited<ReturnType<typeof getPharmacyInventory>>> = ({ signal }) => getPharmacyInventory(id, { signal, ...requestOptions });





   return  { queryKey, queryFn, enabled: id !== null && id !== undefined, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getPharmacyInventory>>, TError, TData> & { queryKey: QueryKey }
}

export type GetPharmacyInventoryQueryResult = NonNullable<Awaited<ReturnType<typeof getPharmacyInventory>>>
export type GetPharmacyInventoryQueryError = ErrorType<unknown>



export function useGetPharmacyInventory<TData = Awaited<ReturnType<typeof getPharmacyInventory>>, TError = ErrorType<unknown>>(
 id: number, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getPharmacyInventory>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getGetPharmacyInventoryQueryOptions(id,options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







export const getUpdateInventoryItemUrl = (id: number,
    itemId: number,) => {




  return `/api/pharmacies/${id}/inventory/${itemId}`
}

export const updateInventoryItem = async (id: number,
    itemId: number,
    inventoryUpdate: InventoryUpdate, options?: RequestInit): Promise<InventoryItem> => {

  return customFetch<InventoryItem>(getUpdateInventoryItemUrl(id,itemId),
  {
    ...options,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(inventoryUpdate)
  }
);}




export const getUpdateInventoryItemMutationOptions = <TError = ErrorType<unknown>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof updateInventoryItem>>, TError,{id: number;itemId: number;data: BodyType<InventoryUpdate>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof updateInventoryItem>>, TError,{id: number;itemId: number;data: BodyType<InventoryUpdate>}, TContext> => {

const mutationKey = ['updateInventoryItem'];
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof updateInventoryItem>>, {id: number;itemId: number;data: BodyType<InventoryUpdate>}> = (props) => {
          const {id,itemId,data} = props ?? {};

          return  updateInventoryItem(id,itemId,data,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type UpdateInventoryItemMutationResult = NonNullable<Awaited<ReturnType<typeof updateInventoryItem>>>
    export type UpdateInventoryItemMutationBody = BodyType<InventoryUpdate>
    export type UpdateInventoryItemMutationError = ErrorType<unknown>

export const useUpdateInventoryItem = <TError = ErrorType<unknown>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof updateInventoryItem>>, TError,{id: number;itemId: number;data: BodyType<InventoryUpdate>}, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof updateInventoryItem>>,
        TError,
        {id: number;itemId: number;data: BodyType<InventoryUpdate>},
        TContext
      > => {
      return useMutation(getUpdateInventoryItemMutationOptions(options));
    }

export const getListPrescriptionsUrl = () => {




  return `/api/prescriptions`
}

export const listPrescriptions = async ( options?: RequestInit): Promise<Prescription[]> => {

  return customFetch<Prescription[]>(getListPrescriptionsUrl(),
  {
    ...options,
    method: 'GET'


  }
);}





export const getListPrescriptionsQueryKey = () => {
    return [
    `/api/prescriptions`
    ] as const;
    }


export const getListPrescriptionsQueryOptions = <TData = Awaited<ReturnType<typeof listPrescriptions>>, TError = ErrorType<unknown>>( options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof listPrescriptions>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getListPrescriptionsQueryKey();



    const queryFn: QueryFunction<Awaited<ReturnType<typeof listPrescriptions>>> = ({ signal }) => listPrescriptions({ signal, ...requestOptions });





   return  { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof listPrescriptions>>, TError, TData> & { queryKey: QueryKey }
}

export type ListPrescriptionsQueryResult = NonNullable<Awaited<ReturnType<typeof listPrescriptions>>>
export type ListPrescriptionsQueryError = ErrorType<unknown>



export function useListPrescriptions<TData = Awaited<ReturnType<typeof listPrescriptions>>, TError = ErrorType<unknown>>(
  options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof listPrescriptions>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getListPrescriptionsQueryOptions(options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







export const getUploadPrescriptionUrl = () => {




  return `/api/prescriptions`
}

export const uploadPrescription = async (prescriptionInput: PrescriptionInput, options?: RequestInit): Promise<Prescription> => {

  return customFetch<Prescription>(getUploadPrescriptionUrl(),
  {
    ...options,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(prescriptionInput)
  }
);}




export const getUploadPrescriptionMutationOptions = <TError = ErrorType<unknown>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof uploadPrescription>>, TError,{data: BodyType<PrescriptionInput>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof uploadPrescription>>, TError,{data: BodyType<PrescriptionInput>}, TContext> => {

const mutationKey = ['uploadPrescription'];
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof uploadPrescription>>, {data: BodyType<PrescriptionInput>}> = (props) => {
          const {data} = props ?? {};

          return  uploadPrescription(data,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type UploadPrescriptionMutationResult = NonNullable<Awaited<ReturnType<typeof uploadPrescription>>>
    export type UploadPrescriptionMutationBody = BodyType<PrescriptionInput>
    export type UploadPrescriptionMutationError = ErrorType<unknown>

export const useUploadPrescription = <TError = ErrorType<unknown>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof uploadPrescription>>, TError,{data: BodyType<PrescriptionInput>}, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof uploadPrescription>>,
        TError,
        {data: BodyType<PrescriptionInput>},
        TContext
      > => {
      return useMutation(getUploadPrescriptionMutationOptions(options));
    }

export const getGetPrescriptionUrl = (id: number,) => {




  return `/api/prescriptions/${id}`
}

export const getPrescription = async (id: number, options?: RequestInit): Promise<Prescription> => {

  return customFetch<Prescription>(getGetPrescriptionUrl(id),
  {
    ...options,
    method: 'GET'


  }
);}





export const getGetPrescriptionQueryKey = (id: number,) => {
    return [
    `/api/prescriptions/${id}`
    ] as const;
    }


export const getGetPrescriptionQueryOptions = <TData = Awaited<ReturnType<typeof getPrescription>>, TError = ErrorType<unknown>>(id: number, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getPrescription>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getGetPrescriptionQueryKey(id);



    const queryFn: QueryFunction<Awaited<ReturnType<typeof getPrescription>>> = ({ signal }) => getPrescription(id, { signal, ...requestOptions });





   return  { queryKey, queryFn, enabled: id !== null && id !== undefined, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getPrescription>>, TError, TData> & { queryKey: QueryKey }
}

export type GetPrescriptionQueryResult = NonNullable<Awaited<ReturnType<typeof getPrescription>>>
export type GetPrescriptionQueryError = ErrorType<unknown>



export function useGetPrescription<TData = Awaited<ReturnType<typeof getPrescription>>, TError = ErrorType<unknown>>(
 id: number, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getPrescription>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getGetPrescriptionQueryOptions(id,options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







export const getListReservationsUrl = (params?: ListReservationsParams,) => {
  const normalizedParams = new URLSearchParams();

  Object.entries(params || {}).forEach(([key, value]) => {

    if (value !== undefined) {
      normalizedParams.append(key, value === null ? 'null' : String(value))
    }
  });

  const stringifiedParams = normalizedParams.toString();

  return stringifiedParams.length > 0 ? `/api/reservations?${stringifiedParams}` : `/api/reservations`
}

export const listReservations = async (params?: ListReservationsParams, options?: RequestInit): Promise<Reservation[]> => {

  return customFetch<Reservation[]>(getListReservationsUrl(params),
  {
    ...options,
    method: 'GET'


  }
);}





export const getListReservationsQueryKey = (params?: ListReservationsParams,) => {
    return [
    `/api/reservations`, ...(params ? [params] : [])
    ] as const;
    }


export const getListReservationsQueryOptions = <TData = Awaited<ReturnType<typeof listReservations>>, TError = ErrorType<unknown>>(params?: ListReservationsParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof listReservations>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getListReservationsQueryKey(params);



    const queryFn: QueryFunction<Awaited<ReturnType<typeof listReservations>>> = ({ signal }) => listReservations(params, { signal, ...requestOptions });





   return  { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof listReservations>>, TError, TData> & { queryKey: QueryKey }
}

export type ListReservationsQueryResult = NonNullable<Awaited<ReturnType<typeof listReservations>>>
export type ListReservationsQueryError = ErrorType<unknown>



export function useListReservations<TData = Awaited<ReturnType<typeof listReservations>>, TError = ErrorType<unknown>>(
 params?: ListReservationsParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof listReservations>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getListReservationsQueryOptions(params,options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







export const getCreateReservationUrl = () => {




  return `/api/reservations`
}

export const createReservation = async (reservationInput: ReservationInput, options?: RequestInit): Promise<Reservation> => {

  return customFetch<Reservation>(getCreateReservationUrl(),
  {
    ...options,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(reservationInput)
  }
);}




export const getCreateReservationMutationOptions = <TError = ErrorType<unknown>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof createReservation>>, TError,{data: BodyType<ReservationInput>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof createReservation>>, TError,{data: BodyType<ReservationInput>}, TContext> => {

const mutationKey = ['createReservation'];
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof createReservation>>, {data: BodyType<ReservationInput>}> = (props) => {
          const {data} = props ?? {};

          return  createReservation(data,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type CreateReservationMutationResult = NonNullable<Awaited<ReturnType<typeof createReservation>>>
    export type CreateReservationMutationBody = BodyType<ReservationInput>
    export type CreateReservationMutationError = ErrorType<unknown>

export const useCreateReservation = <TError = ErrorType<unknown>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof createReservation>>, TError,{data: BodyType<ReservationInput>}, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof createReservation>>,
        TError,
        {data: BodyType<ReservationInput>},
        TContext
      > => {
      return useMutation(getCreateReservationMutationOptions(options));
    }

export const getGetReservationUrl = (id: number,) => {




  return `/api/reservations/${id}`
}

export const getReservation = async (id: number, options?: RequestInit): Promise<Reservation> => {

  return customFetch<Reservation>(getGetReservationUrl(id),
  {
    ...options,
    method: 'GET'


  }
);}





export const getGetReservationQueryKey = (id: number,) => {
    return [
    `/api/reservations/${id}`
    ] as const;
    }


export const getGetReservationQueryOptions = <TData = Awaited<ReturnType<typeof getReservation>>, TError = ErrorType<unknown>>(id: number, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getReservation>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getGetReservationQueryKey(id);



    const queryFn: QueryFunction<Awaited<ReturnType<typeof getReservation>>> = ({ signal }) => getReservation(id, { signal, ...requestOptions });





   return  { queryKey, queryFn, enabled: id !== null && id !== undefined, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getReservation>>, TError, TData> & { queryKey: QueryKey }
}

export type GetReservationQueryResult = NonNullable<Awaited<ReturnType<typeof getReservation>>>
export type GetReservationQueryError = ErrorType<unknown>



export function useGetReservation<TData = Awaited<ReturnType<typeof getReservation>>, TError = ErrorType<unknown>>(
 id: number, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getReservation>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getGetReservationQueryOptions(id,options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







export const getUpdateReservationUrl = (id: number,) => {




  return `/api/reservations/${id}`
}

export const updateReservation = async (id: number,
    reservationUpdate: ReservationUpdate, options?: RequestInit): Promise<Reservation> => {

  return customFetch<Reservation>(getUpdateReservationUrl(id),
  {
    ...options,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(reservationUpdate)
  }
);}




export const getUpdateReservationMutationOptions = <TError = ErrorType<unknown>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof updateReservation>>, TError,{id: number;data: BodyType<ReservationUpdate>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof updateReservation>>, TError,{id: number;data: BodyType<ReservationUpdate>}, TContext> => {

const mutationKey = ['updateReservation'];
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof updateReservation>>, {id: number;data: BodyType<ReservationUpdate>}> = (props) => {
          const {id,data} = props ?? {};

          return  updateReservation(id,data,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type UpdateReservationMutationResult = NonNullable<Awaited<ReturnType<typeof updateReservation>>>
    export type UpdateReservationMutationBody = BodyType<ReservationUpdate>
    export type UpdateReservationMutationError = ErrorType<unknown>

export const useUpdateReservation = <TError = ErrorType<unknown>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof updateReservation>>, TError,{id: number;data: BodyType<ReservationUpdate>}, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof updateReservation>>,
        TError,
        {id: number;data: BodyType<ReservationUpdate>},
        TContext
      > => {
      return useMutation(getUpdateReservationMutationOptions(options));
    }

export const getListOrdersUrl = (params?: ListOrdersParams,) => {
  const normalizedParams = new URLSearchParams();

  Object.entries(params || {}).forEach(([key, value]) => {

    if (value !== undefined) {
      normalizedParams.append(key, value === null ? 'null' : String(value))
    }
  });

  const stringifiedParams = normalizedParams.toString();

  return stringifiedParams.length > 0 ? `/api/orders?${stringifiedParams}` : `/api/orders`
}

export const listOrders = async (params?: ListOrdersParams, options?: RequestInit): Promise<Order[]> => {

  return customFetch<Order[]>(getListOrdersUrl(params),
  {
    ...options,
    method: 'GET'


  }
);}





export const getListOrdersQueryKey = (params?: ListOrdersParams,) => {
    return [
    `/api/orders`, ...(params ? [params] : [])
    ] as const;
    }


export const getListOrdersQueryOptions = <TData = Awaited<ReturnType<typeof listOrders>>, TError = ErrorType<unknown>>(params?: ListOrdersParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof listOrders>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getListOrdersQueryKey(params);



    const queryFn: QueryFunction<Awaited<ReturnType<typeof listOrders>>> = ({ signal }) => listOrders(params, { signal, ...requestOptions });





   return  { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof listOrders>>, TError, TData> & { queryKey: QueryKey }
}

export type ListOrdersQueryResult = NonNullable<Awaited<ReturnType<typeof listOrders>>>
export type ListOrdersQueryError = ErrorType<unknown>



export function useListOrders<TData = Awaited<ReturnType<typeof listOrders>>, TError = ErrorType<unknown>>(
 params?: ListOrdersParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof listOrders>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getListOrdersQueryOptions(params,options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







export const getCreateOrderUrl = () => {




  return `/api/orders`
}

export const createOrder = async (orderInput: OrderInput, options?: RequestInit): Promise<Order> => {

  return customFetch<Order>(getCreateOrderUrl(),
  {
    ...options,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(orderInput)
  }
);}




export const getCreateOrderMutationOptions = <TError = ErrorType<unknown>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof createOrder>>, TError,{data: BodyType<OrderInput>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof createOrder>>, TError,{data: BodyType<OrderInput>}, TContext> => {

const mutationKey = ['createOrder'];
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof createOrder>>, {data: BodyType<OrderInput>}> = (props) => {
          const {data} = props ?? {};

          return  createOrder(data,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type CreateOrderMutationResult = NonNullable<Awaited<ReturnType<typeof createOrder>>>
    export type CreateOrderMutationBody = BodyType<OrderInput>
    export type CreateOrderMutationError = ErrorType<unknown>

export const useCreateOrder = <TError = ErrorType<unknown>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof createOrder>>, TError,{data: BodyType<OrderInput>}, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof createOrder>>,
        TError,
        {data: BodyType<OrderInput>},
        TContext
      > => {
      return useMutation(getCreateOrderMutationOptions(options));
    }

export const getGetOrderUrl = (id: number,) => {




  return `/api/orders/${id}`
}

export const getOrder = async (id: number, options?: RequestInit): Promise<Order> => {

  return customFetch<Order>(getGetOrderUrl(id),
  {
    ...options,
    method: 'GET'


  }
);}





export const getGetOrderQueryKey = (id: number,) => {
    return [
    `/api/orders/${id}`
    ] as const;
    }


export const getGetOrderQueryOptions = <TData = Awaited<ReturnType<typeof getOrder>>, TError = ErrorType<unknown>>(id: number, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getOrder>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getGetOrderQueryKey(id);



    const queryFn: QueryFunction<Awaited<ReturnType<typeof getOrder>>> = ({ signal }) => getOrder(id, { signal, ...requestOptions });





   return  { queryKey, queryFn, enabled: id !== null && id !== undefined, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getOrder>>, TError, TData> & { queryKey: QueryKey }
}

export type GetOrderQueryResult = NonNullable<Awaited<ReturnType<typeof getOrder>>>
export type GetOrderQueryError = ErrorType<unknown>



export function useGetOrder<TData = Awaited<ReturnType<typeof getOrder>>, TError = ErrorType<unknown>>(
 id: number, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getOrder>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getGetOrderQueryOptions(id,options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







export const getGetOrderTrackingUrl = (id: number,) => {




  return `/api/orders/${id}/tracking`
}

export const getOrderTracking = async (id: number, options?: RequestInit): Promise<OrderTracking> => {

  return customFetch<OrderTracking>(getGetOrderTrackingUrl(id),
  {
    ...options,
    method: 'GET'


  }
);}





export const getGetOrderTrackingQueryKey = (id: number,) => {
    return [
    `/api/orders/${id}/tracking`
    ] as const;
    }


export const getGetOrderTrackingQueryOptions = <TData = Awaited<ReturnType<typeof getOrderTracking>>, TError = ErrorType<unknown>>(id: number, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getOrderTracking>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getGetOrderTrackingQueryKey(id);



    const queryFn: QueryFunction<Awaited<ReturnType<typeof getOrderTracking>>> = ({ signal }) => getOrderTracking(id, { signal, ...requestOptions });





   return  { queryKey, queryFn, enabled: id !== null && id !== undefined, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getOrderTracking>>, TError, TData> & { queryKey: QueryKey }
}

export type GetOrderTrackingQueryResult = NonNullable<Awaited<ReturnType<typeof getOrderTracking>>>
export type GetOrderTrackingQueryError = ErrorType<unknown>



export function useGetOrderTracking<TData = Awaited<ReturnType<typeof getOrderTracking>>, TError = ErrorType<unknown>>(
 id: number, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getOrderTracking>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getGetOrderTrackingQueryOptions(id,options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







export const getGetMyProfileUrl = () => {




  return `/api/users/me`
}

export const getMyProfile = async ( options?: RequestInit): Promise<UserProfile> => {

  return customFetch<UserProfile>(getGetMyProfileUrl(),
  {
    ...options,
    method: 'GET'


  }
);}





export const getGetMyProfileQueryKey = () => {
    return [
    `/api/users/me`
    ] as const;
    }


export const getGetMyProfileQueryOptions = <TData = Awaited<ReturnType<typeof getMyProfile>>, TError = ErrorType<unknown>>( options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getMyProfile>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getGetMyProfileQueryKey();



    const queryFn: QueryFunction<Awaited<ReturnType<typeof getMyProfile>>> = ({ signal }) => getMyProfile({ signal, ...requestOptions });





   return  { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getMyProfile>>, TError, TData> & { queryKey: QueryKey }
}

export type GetMyProfileQueryResult = NonNullable<Awaited<ReturnType<typeof getMyProfile>>>
export type GetMyProfileQueryError = ErrorType<unknown>



export function useGetMyProfile<TData = Awaited<ReturnType<typeof getMyProfile>>, TError = ErrorType<unknown>>(
  options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getMyProfile>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getGetMyProfileQueryOptions(options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







export const getUpdateMyProfileUrl = () => {




  return `/api/users/me`
}

export const updateMyProfile = async (userProfileUpdate: UserProfileUpdate, options?: RequestInit): Promise<UserProfile> => {

  return customFetch<UserProfile>(getUpdateMyProfileUrl(),
  {
    ...options,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    body: JSON.stringify(userProfileUpdate)
  }
);}




export const getUpdateMyProfileMutationOptions = <TError = ErrorType<unknown>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof updateMyProfile>>, TError,{data: BodyType<UserProfileUpdate>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof updateMyProfile>>, TError,{data: BodyType<UserProfileUpdate>}, TContext> => {

const mutationKey = ['updateMyProfile'];
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof updateMyProfile>>, {data: BodyType<UserProfileUpdate>}> = (props) => {
          const {data} = props ?? {};

          return  updateMyProfile(data,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type UpdateMyProfileMutationResult = NonNullable<Awaited<ReturnType<typeof updateMyProfile>>>
    export type UpdateMyProfileMutationBody = BodyType<UserProfileUpdate>
    export type UpdateMyProfileMutationError = ErrorType<unknown>

export const useUpdateMyProfile = <TError = ErrorType<unknown>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof updateMyProfile>>, TError,{data: BodyType<UserProfileUpdate>}, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof updateMyProfile>>,
        TError,
        {data: BodyType<UserProfileUpdate>},
        TContext
      > => {
      return useMutation(getUpdateMyProfileMutationOptions(options));
    }

export const getGetPatientDashboardUrl = () => {




  return `/api/users/me/dashboard`
}

export const getPatientDashboard = async ( options?: RequestInit): Promise<PatientDashboard> => {

  return customFetch<PatientDashboard>(getGetPatientDashboardUrl(),
  {
    ...options,
    method: 'GET'


  }
);}





export const getGetPatientDashboardQueryKey = () => {
    return [
    `/api/users/me/dashboard`
    ] as const;
    }


export const getGetPatientDashboardQueryOptions = <TData = Awaited<ReturnType<typeof getPatientDashboard>>, TError = ErrorType<unknown>>( options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getPatientDashboard>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getGetPatientDashboardQueryKey();



    const queryFn: QueryFunction<Awaited<ReturnType<typeof getPatientDashboard>>> = ({ signal }) => getPatientDashboard({ signal, ...requestOptions });





   return  { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getPatientDashboard>>, TError, TData> & { queryKey: QueryKey }
}

export type GetPatientDashboardQueryResult = NonNullable<Awaited<ReturnType<typeof getPatientDashboard>>>
export type GetPatientDashboardQueryError = ErrorType<unknown>



export function useGetPatientDashboard<TData = Awaited<ReturnType<typeof getPatientDashboard>>, TError = ErrorType<unknown>>(
  options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getPatientDashboard>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getGetPatientDashboardQueryOptions(options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







export const getSearchMedicinesUrl = (params: SearchMedicinesParams,) => {
  const normalizedParams = new URLSearchParams();

  Object.entries(params || {}).forEach(([key, value]) => {

    if (value !== undefined) {
      normalizedParams.append(key, value === null ? 'null' : String(value))
    }
  });

  const stringifiedParams = normalizedParams.toString();

  return stringifiedParams.length > 0 ? `/api/search/medicines?${stringifiedParams}` : `/api/search/medicines`
}

export const searchMedicines = async (params: SearchMedicinesParams, options?: RequestInit): Promise<MedicineSearchResult> => {

  return customFetch<MedicineSearchResult>(getSearchMedicinesUrl(params),
  {
    ...options,
    method: 'GET'


  }
);}





export const getSearchMedicinesQueryKey = (params?: SearchMedicinesParams,) => {
    return [
    `/api/search/medicines`, ...(params ? [params] : [])
    ] as const;
    }


export const getSearchMedicinesQueryOptions = <TData = Awaited<ReturnType<typeof searchMedicines>>, TError = ErrorType<unknown>>(params: SearchMedicinesParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof searchMedicines>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getSearchMedicinesQueryKey(params);



    const queryFn: QueryFunction<Awaited<ReturnType<typeof searchMedicines>>> = ({ signal }) => searchMedicines(params, { signal, ...requestOptions });





   return  { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof searchMedicines>>, TError, TData> & { queryKey: QueryKey }
}

export type SearchMedicinesQueryResult = NonNullable<Awaited<ReturnType<typeof searchMedicines>>>
export type SearchMedicinesQueryError = ErrorType<unknown>



export function useSearchMedicines<TData = Awaited<ReturnType<typeof searchMedicines>>, TError = ErrorType<unknown>>(
 params: SearchMedicinesParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof searchMedicines>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getSearchMedicinesQueryOptions(params,options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







export const getGetSearchSuggestionsUrl = (params: GetSearchSuggestionsParams,) => {
  const normalizedParams = new URLSearchParams();

  Object.entries(params || {}).forEach(([key, value]) => {

    if (value !== undefined) {
      normalizedParams.append(key, value === null ? 'null' : String(value))
    }
  });

  const stringifiedParams = normalizedParams.toString();

  return stringifiedParams.length > 0 ? `/api/search/suggestions?${stringifiedParams}` : `/api/search/suggestions`
}

export const getSearchSuggestions = async (params: GetSearchSuggestionsParams, options?: RequestInit): Promise<SearchSuggestion[]> => {

  return customFetch<SearchSuggestion[]>(getGetSearchSuggestionsUrl(params),
  {
    ...options,
    method: 'GET'


  }
);}





export const getGetSearchSuggestionsQueryKey = (params?: GetSearchSuggestionsParams,) => {
    return [
    `/api/search/suggestions`, ...(params ? [params] : [])
    ] as const;
    }


export const getGetSearchSuggestionsQueryOptions = <TData = Awaited<ReturnType<typeof getSearchSuggestions>>, TError = ErrorType<unknown>>(params: GetSearchSuggestionsParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getSearchSuggestions>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getGetSearchSuggestionsQueryKey(params);



    const queryFn: QueryFunction<Awaited<ReturnType<typeof getSearchSuggestions>>> = ({ signal }) => getSearchSuggestions(params, { signal, ...requestOptions });





   return  { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getSearchSuggestions>>, TError, TData> & { queryKey: QueryKey }
}

export type GetSearchSuggestionsQueryResult = NonNullable<Awaited<ReturnType<typeof getSearchSuggestions>>>
export type GetSearchSuggestionsQueryError = ErrorType<unknown>



export function useGetSearchSuggestions<TData = Awaited<ReturnType<typeof getSearchSuggestions>>, TError = ErrorType<unknown>>(
 params: GetSearchSuggestionsParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getSearchSuggestions>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getGetSearchSuggestionsQueryOptions(params,options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







export const getGetPharmacyDashboardUrl = () => {




  return `/api/analytics/pharmacy-dashboard`
}

export const getPharmacyDashboard = async ( options?: RequestInit): Promise<PharmacyDashboard> => {

  return customFetch<PharmacyDashboard>(getGetPharmacyDashboardUrl(),
  {
    ...options,
    method: 'GET'


  }
);}





export const getGetPharmacyDashboardQueryKey = () => {
    return [
    `/api/analytics/pharmacy-dashboard`
    ] as const;
    }


export const getGetPharmacyDashboardQueryOptions = <TData = Awaited<ReturnType<typeof getPharmacyDashboard>>, TError = ErrorType<unknown>>( options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getPharmacyDashboard>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getGetPharmacyDashboardQueryKey();



    const queryFn: QueryFunction<Awaited<ReturnType<typeof getPharmacyDashboard>>> = ({ signal }) => getPharmacyDashboard({ signal, ...requestOptions });





   return  { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getPharmacyDashboard>>, TError, TData> & { queryKey: QueryKey }
}

export type GetPharmacyDashboardQueryResult = NonNullable<Awaited<ReturnType<typeof getPharmacyDashboard>>>
export type GetPharmacyDashboardQueryError = ErrorType<unknown>



export function useGetPharmacyDashboard<TData = Awaited<ReturnType<typeof getPharmacyDashboard>>, TError = ErrorType<unknown>>(
  options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getPharmacyDashboard>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getGetPharmacyDashboardQueryOptions(options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







export const getGetDemandForecastUrl = (params?: GetDemandForecastParams,) => {
  const normalizedParams = new URLSearchParams();

  Object.entries(params || {}).forEach(([key, value]) => {

    if (value !== undefined) {
      normalizedParams.append(key, value === null ? 'null' : String(value))
    }
  });

  const stringifiedParams = normalizedParams.toString();

  return stringifiedParams.length > 0 ? `/api/analytics/demand-forecast?${stringifiedParams}` : `/api/analytics/demand-forecast`
}

export const getDemandForecast = async (params?: GetDemandForecastParams, options?: RequestInit): Promise<DemandForecastItem[]> => {

  return customFetch<DemandForecastItem[]>(getGetDemandForecastUrl(params),
  {
    ...options,
    method: 'GET'


  }
);}





export const getGetDemandForecastQueryKey = (params?: GetDemandForecastParams,) => {
    return [
    `/api/analytics/demand-forecast`, ...(params ? [params] : [])
    ] as const;
    }


export const getGetDemandForecastQueryOptions = <TData = Awaited<ReturnType<typeof getDemandForecast>>, TError = ErrorType<unknown>>(params?: GetDemandForecastParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getDemandForecast>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getGetDemandForecastQueryKey(params);



    const queryFn: QueryFunction<Awaited<ReturnType<typeof getDemandForecast>>> = ({ signal }) => getDemandForecast(params, { signal, ...requestOptions });





   return  { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getDemandForecast>>, TError, TData> & { queryKey: QueryKey }
}

export type GetDemandForecastQueryResult = NonNullable<Awaited<ReturnType<typeof getDemandForecast>>>
export type GetDemandForecastQueryError = ErrorType<unknown>



export function useGetDemandForecast<TData = Awaited<ReturnType<typeof getDemandForecast>>, TError = ErrorType<unknown>>(
 params?: GetDemandForecastParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getDemandForecast>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getGetDemandForecastQueryOptions(params,options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







export const getGetAdminDashboardUrl = () => {




  return `/api/analytics/admin-dashboard`
}

export const getAdminDashboard = async ( options?: RequestInit): Promise<AdminDashboard> => {

  return customFetch<AdminDashboard>(getGetAdminDashboardUrl(),
  {
    ...options,
    method: 'GET'


  }
);}





export const getGetAdminDashboardQueryKey = () => {
    return [
    `/api/analytics/admin-dashboard`
    ] as const;
    }


export const getGetAdminDashboardQueryOptions = <TData = Awaited<ReturnType<typeof getAdminDashboard>>, TError = ErrorType<unknown>>( options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getAdminDashboard>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getGetAdminDashboardQueryKey();



    const queryFn: QueryFunction<Awaited<ReturnType<typeof getAdminDashboard>>> = ({ signal }) => getAdminDashboard({ signal, ...requestOptions });





   return  { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getAdminDashboard>>, TError, TData> & { queryKey: QueryKey }
}

export type GetAdminDashboardQueryResult = NonNullable<Awaited<ReturnType<typeof getAdminDashboard>>>
export type GetAdminDashboardQueryError = ErrorType<unknown>



export function useGetAdminDashboard<TData = Awaited<ReturnType<typeof getAdminDashboard>>, TError = ErrorType<unknown>>(
  options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getAdminDashboard>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getGetAdminDashboardQueryOptions(options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







export const getGetTopMedicinesUrl = (params?: GetTopMedicinesParams,) => {
  const normalizedParams = new URLSearchParams();

  Object.entries(params || {}).forEach(([key, value]) => {

    if (value !== undefined) {
      normalizedParams.append(key, value === null ? 'null' : String(value))
    }
  });

  const stringifiedParams = normalizedParams.toString();

  return stringifiedParams.length > 0 ? `/api/analytics/top-medicines?${stringifiedParams}` : `/api/analytics/top-medicines`
}

export const getTopMedicines = async (params?: GetTopMedicinesParams, options?: RequestInit): Promise<TopMedicine[]> => {

  return customFetch<TopMedicine[]>(getGetTopMedicinesUrl(params),
  {
    ...options,
    method: 'GET'


  }
);}





export const getGetTopMedicinesQueryKey = (params?: GetTopMedicinesParams,) => {
    return [
    `/api/analytics/top-medicines`, ...(params ? [params] : [])
    ] as const;
    }


export const getGetTopMedicinesQueryOptions = <TData = Awaited<ReturnType<typeof getTopMedicines>>, TError = ErrorType<unknown>>(params?: GetTopMedicinesParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getTopMedicines>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getGetTopMedicinesQueryKey(params);



    const queryFn: QueryFunction<Awaited<ReturnType<typeof getTopMedicines>>> = ({ signal }) => getTopMedicines(params, { signal, ...requestOptions });





   return  { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getTopMedicines>>, TError, TData> & { queryKey: QueryKey }
}

export type GetTopMedicinesQueryResult = NonNullable<Awaited<ReturnType<typeof getTopMedicines>>>
export type GetTopMedicinesQueryError = ErrorType<unknown>



export function useGetTopMedicines<TData = Awaited<ReturnType<typeof getTopMedicines>>, TError = ErrorType<unknown>>(
 params?: GetTopMedicinesParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getTopMedicines>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getGetTopMedicinesQueryOptions(params,options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







export const getListNotificationsUrl = (params?: ListNotificationsParams,) => {
  const normalizedParams = new URLSearchParams();

  Object.entries(params || {}).forEach(([key, value]) => {

    if (value !== undefined) {
      normalizedParams.append(key, value === null ? 'null' : String(value))
    }
  });

  const stringifiedParams = normalizedParams.toString();

  return stringifiedParams.length > 0 ? `/api/notifications?${stringifiedParams}` : `/api/notifications`
}

export const listNotifications = async (params?: ListNotificationsParams, options?: RequestInit): Promise<Notification[]> => {

  return customFetch<Notification[]>(getListNotificationsUrl(params),
  {
    ...options,
    method: 'GET'


  }
);}





export const getListNotificationsQueryKey = (params?: ListNotificationsParams,) => {
    return [
    `/api/notifications`, ...(params ? [params] : [])
    ] as const;
    }


export const getListNotificationsQueryOptions = <TData = Awaited<ReturnType<typeof listNotifications>>, TError = ErrorType<unknown>>(params?: ListNotificationsParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof listNotifications>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getListNotificationsQueryKey(params);



    const queryFn: QueryFunction<Awaited<ReturnType<typeof listNotifications>>> = ({ signal }) => listNotifications(params, { signal, ...requestOptions });





   return  { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof listNotifications>>, TError, TData> & { queryKey: QueryKey }
}

export type ListNotificationsQueryResult = NonNullable<Awaited<ReturnType<typeof listNotifications>>>
export type ListNotificationsQueryError = ErrorType<unknown>



export function useListNotifications<TData = Awaited<ReturnType<typeof listNotifications>>, TError = ErrorType<unknown>>(
 params?: ListNotificationsParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof listNotifications>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getListNotificationsQueryOptions(params,options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







export const getMarkNotificationReadUrl = (id: number,) => {




  return `/api/notifications/${id}/read`
}

export const markNotificationRead = async (id: number, options?: RequestInit): Promise<Notification> => {

  return customFetch<Notification>(getMarkNotificationReadUrl(id),
  {
    ...options,
    method: 'PATCH'


  }
);}




export const getMarkNotificationReadMutationOptions = <TError = ErrorType<unknown>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof markNotificationRead>>, TError,{id: number}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof markNotificationRead>>, TError,{id: number}, TContext> => {

const mutationKey = ['markNotificationRead'];
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof markNotificationRead>>, {id: number}> = (props) => {
          const {id} = props ?? {};

          return  markNotificationRead(id,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type MarkNotificationReadMutationResult = NonNullable<Awaited<ReturnType<typeof markNotificationRead>>>

    export type MarkNotificationReadMutationError = ErrorType<unknown>

export const useMarkNotificationRead = <TError = ErrorType<unknown>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof markNotificationRead>>, TError,{id: number}, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof markNotificationRead>>,
        TError,
        {id: number},
        TContext
      > => {
      return useMutation(getMarkNotificationReadMutationOptions(options));
    }

